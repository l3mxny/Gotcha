"""Centralized environment loading and validation for optional integrations."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable


REQUIRED_CALL911 = (
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_VOICE_ID",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY",
    "TWILIO_API_SECRET",
    "TWILIO_TWIML_APP_SID",
    "TWILIO_CALLER_ID",
    "FRIEND_PHONE_NUMBER",
    "PUBLIC_BASE_URL",
)

@dataclass(frozen=True)
class Call911Env:
    gemini_api_key: str | None
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    twilio_account_sid: str
    twilio_api_key: str
    twilio_api_secret: str
    twilio_twiml_app_sid: str
    twilio_caller_id: str
    friend_phone_number: str
    public_base_url: str


def _strip_base_url(url: str) -> str:
    return url.rstrip("/")


def missing_env(keys: Iterable[str]) -> list[str]:
    out: list[str] = []
    for k in keys:
        v = os.getenv(k)
        if v is None or str(v).strip() == "":
            out.append(k)
    return out


def validate_call911_env() -> list[str]:
    """Return list of missing variable names (empty if all present)."""
    return missing_env(REQUIRED_CALL911)


def get_call911_env() -> Call911Env:
    miss = validate_call911_env()
    if miss:
        raise RuntimeError(
            "Missing required environment variables for Call 911: "
            + ", ".join(miss)
        )
    return Call911Env(
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        elevenlabs_api_key=os.environ["ELEVENLABS_API_KEY"].strip(),
        elevenlabs_voice_id=os.environ["ELEVENLABS_VOICE_ID"].strip(),
        twilio_account_sid=os.environ["TWILIO_ACCOUNT_SID"].strip(),
        twilio_api_key=os.environ["TWILIO_API_KEY"].strip(),
        twilio_api_secret=os.environ["TWILIO_API_SECRET"].strip(),
        twilio_twiml_app_sid=os.environ["TWILIO_TWIML_APP_SID"].strip(),
        twilio_caller_id=os.environ["TWILIO_CALLER_ID"].strip(),
        friend_phone_number=os.environ["FRIEND_PHONE_NUMBER"].strip(),
        public_base_url=_strip_base_url(os.environ["PUBLIC_BASE_URL"].strip()),
    )


def public_audio_url(filename: str) -> str:
    base = get_call911_env().public_base_url
    return f"{base}/static/generated_audio/{filename}"


def _looks_like_placeholder(val: str) -> bool:
    """Detect obvious placeholder patterns like SKxxxxxxxx or YOUR_..."""
    low = val.lower()
    if "xxxxxxxx" in low:
        return True
    if low.startswith("your_") or low.startswith("your-"):
        return True
    return False


def twilio_env_shape_hints(env: Call911Env) -> list[str]:
    """
    Catch common Twilio Console copy/paste mistakes before token or calls fail opaquely.
    Returns human-readable hints (empty list if shapes look OK).
    """
    hints: list[str] = []
    if not env.twilio_account_sid.startswith("AC"):
        hints.append(
            "TWILIO_ACCOUNT_SID should be your Account SID (starts with AC). "
            "If yours starts with SK, that value belongs in TWILIO_API_KEY instead."
        )
    if not env.twilio_api_key.startswith("SK"):
        hints.append(
            "TWILIO_API_KEY should be the API Key SID created under API keys (starts with SK)."
        )
    elif _looks_like_placeholder(env.twilio_api_key):
        hints.append(
            "TWILIO_API_KEY looks like a placeholder (contains 'xxxxxxxx'). "
            "Replace it with your real SK… API Key SID from Twilio Console → API keys."
        )
    if _looks_like_placeholder(env.twilio_api_secret):
        hints.append(
            "TWILIO_API_SECRET looks like a placeholder. "
            "Replace it with the real secret shown when you created the API key."
        )
    if not env.twilio_twiml_app_sid.startswith("AP"):
        hints.append(
            "TWILIO_TWIML_APP_SID should be the TwiML App SID (starts with AP)."
        )
    if env.public_base_url.startswith("http://"):
        hints.append(
            "PUBLIC_BASE_URL should use https in production; http may break Twilio or browser checks."
        )
    if not env.friend_phone_number.startswith("+"):
        hints.append("FRIEND_PHONE_NUMBER should be E.164 including a leading + (e.g. +15551234567).")
    if not env.twilio_caller_id.startswith("+"):
        hints.append("TWILIO_CALLER_ID should be E.164 including a leading +.")
    return hints
