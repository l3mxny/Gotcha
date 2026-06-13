"""Generate emergency narration text via Gemini or file fallback."""

from __future__ import annotations

import io
import logging
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_MESSAGE_PATH = _DATA_DIR / "emergency_message.txt"


def _read_message_file() -> str:
    if _MESSAGE_PATH.is_file():
        text = _MESSAGE_PATH.read_text(encoding="utf-8").strip()
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
    Return the current emergency message from emergency_message.txt.
    That file is kept up-to-date by analyze_evidence_and_generate_message().
    """
    return _read_message_file()


def analyze_evidence_and_generate_message(
    *,
    frames: list[bytes],
    gemini_api_key: str | None,
) -> str | None:
    """
    Send up to 5 evidence frames to Gemini 2.0 Flash for multi-modal analysis.
    Generates a personalized ~10-second emergency phone message with suspect
    descriptors and overwrites emergency_message.txt on success.
    Returns the message string, or None on failure (leaving the old file intact).
    """
    if not gemini_api_key:
        logger.warning("GEMINI_API_KEY not set; skipping evidence analysis.")
        return None

    try:
        from google import genai

        client = genai.Client(api_key=gemini_api_key)

        images: list[Image.Image] = [Image.open(io.BytesIO(frame_bytes)) for frame_bytes in frames]

        if not images:
            logger.warning("No evidence frames provided; skipping analysis.")
            return None

        prompt = (
            "You are a store security AI. Analyze these sequential frames of a "
            "potential shoplifting incident. Identify the suspect and note unique "
            "physical identifiers: gender, estimated build, hair color/style, and "
            "specific clothing details (color, brand, logos, accessories). "
            "Then compose a concise, urgent ~10-second spoken emergency message "
            "for a phone call to authorities that includes these identifiers. "
            "Start directly — no greeting to a named person. "
            "Plain language only, no stage directions, no bullet points. "
            "Output ONLY the final spoken message, nothing else."
        )

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, *images],
        )
        text = (resp.text or "").strip()

        if not text:
            logger.warning("Gemini returned empty analysis; keeping existing message file.")
            return None

        _MESSAGE_PATH.write_text(text, encoding="utf-8")
        logger.info(
            "Gemini evidence analysis complete (%d chars): %s",
            len(text),
            text[:120],
        )
        return text

    except Exception:
        logger.exception("Gemini evidence analysis failed; keeping existing message file.")
        return None
