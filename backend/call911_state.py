"""In-memory mapping of call sessions to public audio URLs (short-lived)."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass


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
