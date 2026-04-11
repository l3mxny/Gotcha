"""Generate emergency narration text via Gemini or file fallback."""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_MESSAGE_PATH = Path(__file__).resolve().parent.parent / "data" / "emergency_message_default.txt"


def _read_default_file() -> str:
    if _DEFAULT_MESSAGE_PATH.is_file():
        text = _DEFAULT_MESSAGE_PATH.read_text(encoding="utf-8").strip()
        if text:
            return text
    return (
        "This is an automated demo message from the store security system. "
        "A potential theft incident was flagged. Please check in with the site operator."
    )


def generate_emergency_message(
    *,
    gemini_api_key: str | None,
    theft_context: str | None = None,
) -> str:
    """
    Produce the script that will be converted to speech.
    Uses Gemini when GEMINI_API_KEY is configured; otherwise a local default file.
    """
    if not gemini_api_key:
        logger.info("GEMINI_API_KEY not set; using default emergency message file/text.")
        return _read_default_file()

    try:
        import google.generativeai as genai  # type: ignore import-not-found

        genai.configure(api_key=gemini_api_key)
        model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        model = genai.GenerativeModel(model_name)
        ctx = theft_context or "A shoplifting alert was triggered at the storefront."
        prompt = (
            "Write a concise 20–35 second spoken emergency-style message for a phone call. "
            "No greeting to a named person; start directly. "
            "Plain language, no stage directions, no bullet points. "
            "Context from the system: "
            + ctx
        )
        resp = model.generate_content(prompt)
        text = (resp.text or "").strip()
        if not text:
            logger.warning("Gemini returned empty text; falling back to default file.")
            return _read_default_file()
        logger.info("Gemini generated emergency message (%d chars).", len(text))
        return text
    except Exception:
        logger.exception("Gemini generation failed; falling back to default file.")
        return _read_default_file()
