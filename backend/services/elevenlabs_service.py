"""ElevenLabs text-to-speech (MP3 bytes only — no secrets in responses)."""

from __future__ import annotations

import logging
import os
from typing import Final, Optional

import requests

logger = logging.getLogger(__name__)

_TTS_URL: Final[str] = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
_VOICE_GET_URL: Final[str] = "https://api.elevenlabs.io/v1/voices/{voice_id}"

DEFAULT_MODEL_ID = "eleven_multilingual_v2"
# Tried in order after the primary model if ElevenLabs rejects the request (plan/model mismatch).
_FALLBACK_MODEL_IDS: Final[tuple[str, ...]] = (
    "eleven_flash_v2_5",
    "eleven_turbo_v2_5",
    "eleven_monolingual_v1",
)

_RETRYABLE_TTS_STATUS = frozenset({400, 403, 404, 422})


def _primary_model_id() -> str:
    raw = (os.getenv("ELEVENLABS_MODEL_ID") or DEFAULT_MODEL_ID).strip()
    return raw or DEFAULT_MODEL_ID


def _model_id_chain() -> list[str]:
    primary = _primary_model_id()
    out = [primary]
    for m in _FALLBACK_MODEL_IDS:
        if m not in out:
            out.append(m)
    return out


def _log_elevenlabs_http_error(r: requests.Response, context: str) -> None:
    snippet = (r.text or "").replace("\n", " ")[:500]
    logger.error(
        "%s: status=%s body_snippet=%s",
        context,
        r.status_code,
        snippet,
    )


def probe_elevenlabs_voice(*, api_key: str, voice_id: str) -> tuple[bool, int, str]:
    """
    Lightweight check: does this API key see this voice_id?
    Returns (ok, http_status, error_hint_for_json).
    """
    url = _VOICE_GET_URL.format(voice_id=voice_id)
    headers = {"xi-api-key": api_key}
    try:
        r = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as exc:
        logger.exception("ElevenLabs voice probe network error.")
        return False, 0, str(exc)[:200]

    if r.ok:
        logger.info("ElevenLabs voice probe OK (status=%s).", r.status_code)
        return True, r.status_code, ""

    _log_elevenlabs_http_error(r, "ElevenLabs voice probe")
    hint = (r.text or "").replace("\n", " ")[:200]
    if not hint:
        hint = f"HTTP {r.status_code}"
    return False, r.status_code, hint


def synthesize_mp3(*, api_key: str, voice_id: str, text: str) -> bytes:
    if not text.strip():
        raise ValueError("TTS text is empty.")
    url = _TTS_URL.format(voice_id=voice_id)
    headers = {
        "xi-api-key": api_key,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    models = _model_id_chain()
    last: Optional[requests.Response] = None

    for model_id in models:
        body = {"text": text, "model_id": model_id}
        logger.info(
            "Requesting ElevenLabs TTS (%d chars) model_id=%s.",
            len(text),
            model_id,
        )
        r = requests.post(url, headers=headers, json=body, timeout=120)
        if r.ok:
            data = r.content
            if not data or len(data) < 100:
                raise RuntimeError(
                    "ElevenLabs returned an empty or suspiciously small MP3."
                )
            logger.info("ElevenLabs returned MP3 (%d bytes).", len(data))
            return data

        _log_elevenlabs_http_error(r, "ElevenLabs TTS")
        last = r

        if r.status_code == 401:
            r.raise_for_status()

        if r.status_code not in _RETRYABLE_TTS_STATUS:
            r.raise_for_status()

        logger.warning(
            "ElevenLabs TTS model_id=%s returned %s; trying next fallback model.",
            model_id,
            r.status_code,
        )

    if last is not None:
        last.raise_for_status()
    raise RuntimeError("ElevenLabs TTS failed with no response")
