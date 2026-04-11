"""REST endpoints for Call 911 demo: TTS prep, Twilio token, and TwiML."""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

import requests
from flask import Blueprint, jsonify, request
from twilio.twiml.voice_response import VoiceResponse

from call911_state import get_session, store_session
from services.elevenlabs_service import probe_elevenlabs_voice, synthesize_mp3
from services.env_config import (
    get_call911_env,
    missing_env,
    public_audio_url,
    twilio_env_shape_hints,
    validate_call911_env,
)
from services.gemini_service import generate_emergency_message
from services.twilio_service import create_voice_access_token

logger = logging.getLogger(__name__)

bp = Blueprint("call911", __name__, url_prefix="/api")

_BACKEND_ROOT = Path(__file__).resolve().parent
_AUDIO_DIR = _BACKEND_ROOT / "static" / "generated_audio"

# ngrok free tier and some CDNs block bare HEAD/GET without a browser-like hint.
_VERIFY_HEADERS = {
    "User-Agent": "GotchaCall911/1.0",
    # Suppress ngrok interstitial HTML for programmatic fetches from this server.
    "ngrok-skip-browser-warning": "true",
}


def _ensure_audio_dir() -> None:
    _AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _verify_audio_url_reachable(url: str) -> None:
    """
    Confirm Twilio will be able to GET the MP3 from the public internet.
    Tries HEAD first, then a small GET if HEAD is not allowed.
    """
    try:
        head = requests.head(
            url, timeout=20, allow_redirects=True, headers=_VERIFY_HEADERS
        )
        if head.status_code < 400:
            logger.info("HEAD OK for audio URL (status=%s).", head.status_code)
            return
        logger.warning(
            "HEAD returned %s for audio URL; trying GET fallback.",
            head.status_code,
        )
    except requests.RequestException as exc:
        logger.warning("HEAD failed for audio URL (%s); trying GET fallback.", exc)

    try:
        with requests.get(
            url,
            timeout=25,
            stream=True,
            allow_redirects=True,
            headers=_VERIFY_HEADERS,
        ) as r:
            if r.status_code >= 400:
                raise RuntimeError(
                    f"Audio URL returned HTTP {r.status_code}; Twilio <Play> may fail."
                )
            chunk = next(r.iter_content(chunk_size=64), b"")
            if not chunk:
                raise RuntimeError("Audio URL GET returned empty body.")
        logger.info("GET fallback succeeded for audio URL.")
    except requests.RequestException as exc:
        logger.exception("Could not verify audio URL.")
        raise RuntimeError(f"Audio URL is not reachable from this server: {exc}") from exc


@bp.route("/call-911/status", methods=["GET"])
def call_911_status():
    """Lightweight diagnostics: which env vars are missing and Twilio SID shape hints."""
    miss = validate_call911_env()
    body: dict = {
        "ok": True,
        "requiredEnvPresent": len(miss) == 0,
        "missingEnv": miss,
    }
    if not miss:
        cfg = get_call911_env()
        body["twilioHints"] = twilio_env_shape_hints(cfg)
        body["publicBaseUrlIsHttps"] = cfg.public_base_url.lower().startswith("https://")
    return jsonify(body)


@bp.route("/call-911/health-tts", methods=["GET"])
def call_911_health_tts():
    """
    curl-friendly check: can ElevenLabs see this voice with this API key?
    Does not call full /start (no MP3 file, no Twilio).
    """
    need = ("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID")
    miss = missing_env(need)
    if miss:
        return jsonify(
            {
                "elevenlabsOk": False,
                "statusCode": 0,
                "errorHint": "Missing env: " + ", ".join(miss),
            }
        )

    api_key = os.environ["ELEVENLABS_API_KEY"].strip()
    voice_id = os.environ["ELEVENLABS_VOICE_ID"].strip()
    ok, code, hint = probe_elevenlabs_voice(api_key=api_key, voice_id=voice_id)
    return jsonify(
        {
            "elevenlabsOk": ok,
            "statusCode": code,
            "errorHint": hint if hint else ("" if ok else "Voice check failed"),
        }
    )


@bp.route("/call-911/start", methods=["POST"])
def call_911_start():
    miss = validate_call911_env()
    if miss:
        logger.error("Call 911 start blocked; missing env: %s", miss)
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "server_misconfigured",
                    "missingEnv": miss,
                }
            ),
            503,
        )

    cfg = get_call911_env()
    shape_hints = twilio_env_shape_hints(cfg)
    if shape_hints:
        logger.error("Call 911 Twilio env shape issues: %s", shape_hints)
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "twilio_env_misconfigured",
                    "hints": shape_hints,
                }
            ),
            400,
        )

    try:
        theft_context = None
        if request.is_json:
            payload = request.get_json(silent=True) or {}
            theft_context = payload.get("theftContext")
            if theft_context is not None:
                theft_context = str(theft_context)[:2000]

        message = generate_emergency_message(
            gemini_api_key=cfg.gemini_api_key,
            theft_context=theft_context,
        )
        mp3 = synthesize_mp3(
            api_key=cfg.elevenlabs_api_key,
            voice_id=cfg.elevenlabs_voice_id,
            text=message,
        )

        _ensure_audio_dir()
        session_id = uuid.uuid4().hex
        filename = f"{session_id}.mp3"
        path = _AUDIO_DIR / filename
        path.write_bytes(mp3)

        audio_url = public_audio_url(filename)
        _verify_audio_url_reachable(audio_url)
        store_session(session_id, audio_url)

        logger.info(
            "Call 911 start complete session=%s audioUrl=%s",
            session_id,
            audio_url,
        )
        return jsonify(
            {
                "ok": True,
                "callSessionId": session_id,
                "audioUrl": audio_url,
            }
        )
    except Exception as exc:
        logger.exception("Call 911 start failed.")
        return jsonify({"ok": False, "error": "start_failed", "message": str(exc)}), 500


@bp.route("/twilio/token", methods=["GET"])
def twilio_token():
    miss = validate_call911_env()
    if miss:
        return (
            jsonify({"ok": False, "error": "server_misconfigured", "missingEnv": miss}),
            503,
        )
    cfg = get_call911_env()
    shape_hints = twilio_env_shape_hints(cfg)
    if shape_hints:
        logger.error("Twilio token blocked; env shape issues: %s", shape_hints)
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "twilio_env_misconfigured",
                    "hints": shape_hints,
                }
            ),
            400,
        )
    try:
        jwt = create_voice_access_token(
            account_sid=cfg.twilio_account_sid,
            api_key_sid=cfg.twilio_api_key,
            api_secret=cfg.twilio_api_secret,
            twiml_app_sid=cfg.twilio_twiml_app_sid,
        )
        return jsonify({"ok": True, "token": jwt})
    except Exception as exc:
        logger.exception("Twilio token failed.")
        return jsonify({"ok": False, "error": "token_failed", "message": str(exc)}), 500


@bp.route("/twilio/voice", methods=["POST"])
def twilio_voice():
    """TwiML for the browser-initiated leg (TwiML App Voice URL)."""
    miss = validate_call911_env()
    if miss:
        vr = VoiceResponse()
        vr.say("Server is not configured for calls.")
        vr.hangup()
        return str(vr), 200, {"Content-Type": "text/xml"}

    cfg = get_call911_env()
    call_session_id = (request.values.get("callSessionId") or "").strip()
    if not call_session_id:
        logger.error("twilio/voice missing callSessionId")
        vr = VoiceResponse()
        vr.say("Missing session.")
        vr.hangup()
        return str(vr), 200, {"Content-Type": "text/xml"}

    sess = get_session(call_session_id)
    if not sess:
        logger.error("twilio/voice unknown or expired session=%s", call_session_id)
        vr = VoiceResponse()
        vr.say("Session expired. Regenerate audio and try again.")
        vr.hangup()
        return str(vr), 200, {"Content-Type": "text/xml"}

    answer_url = (
        f"{cfg.public_base_url}/api/twilio/callee-answer?callSessionId={call_session_id}"
    )
    vr = VoiceResponse()
    dial = vr.dial(caller_id=cfg.twilio_caller_id, answer_on_bridge=True)
    dial.number(cfg.friend_phone_number, url=answer_url)
    logger.info("twilio/voice Dial outbound session=%s", call_session_id)
    return str(vr), 200, {"Content-Type": "text/xml"}


@bp.route("/twilio/callee-answer", methods=["POST", "GET"])
def twilio_callee_answer():
    """TwiML executed on the PSTN leg when the callee answers — plays stored MP3."""
    call_session_id = (request.values.get("callSessionId") or request.args.get("callSessionId") or "").strip()
    vr = VoiceResponse()
    if not call_session_id:
        vr.say("Invalid callback.")
        vr.hangup()
        return str(vr), 200, {"Content-Type": "text/xml"}

    sess = get_session(call_session_id)
    if not sess:
        logger.error("callee-answer missing session=%s", call_session_id)
        vr.say("Audio session expired.")
        vr.hangup()
        return str(vr), 200, {"Content-Type": "text/xml"}

    logger.info("callee-answer playing url for session=%s", call_session_id)
    vr.play(sess.audio_url)
    return str(vr), 200, {"Content-Type": "text/xml"}
