"""In-memory mapping of call sessions to public audio URLs (short-lived)."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_AUDIO_DIR = Path(__file__).resolve().parent / "static" / "generated_audio"


@dataclass
class CallSession:
    audio_url: str
    created_at: float


_lock = threading.Lock()
_sessions: dict[str, CallSession] = {}
_TTL_SEC = 60 * 45


def store_session(session_id: str, audio_url: str) -> None:
    with _lock:
        _sessions[session_id] = CallSession(audio_url=audio_url, created_at=time.time())


def get_session(session_id: str) -> CallSession | None:
    now = time.time()
    with _lock:
        _purge_locked(now)
        s = _sessions.get(session_id)
        return s


def _purge_locked(now: float) -> None:
    dead = [k for k, v in _sessions.items() if now - v.created_at > _TTL_SEC]
    for k in dead:
        del _sessions[k]
        mp3_path = _AUDIO_DIR / f"{k}.mp3"
        try:
            mp3_path.unlink(missing_ok=True)
        except Exception:
            logger.exception("Failed to delete expired audio file %s", mp3_path)
