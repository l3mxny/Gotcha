"""Twilio access tokens (server-side) and helpers."""

from __future__ import annotations

import logging
import secrets
from typing import Any

from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant

logger = logging.getLogger(__name__)


def create_voice_access_token(
    *,
    account_sid: str,
    api_key_sid: str,
    api_secret: str,
    twiml_app_sid: str,
    identity: str | None = None,
    ttl_seconds: int = 3600,
) -> str:
    """Return a JWT string for the Twilio Voice JavaScript SDK."""
    ident = identity or f"gotcha-{secrets.token_hex(6)}"
    token = AccessToken(account_sid, api_key_sid, api_secret, identity=ident, ttl=ttl_seconds)
    grant = VoiceGrant(outgoing_application_sid=twiml_app_sid, incoming_allow=True)
    token.add_grant(grant)
    jwt: Any = token.to_jwt()
    out = jwt.decode("utf-8") if isinstance(jwt, (bytes, bytearray)) else str(jwt)
    logger.info("Issued Twilio Voice access token for identity=%s", ident)
    return out
