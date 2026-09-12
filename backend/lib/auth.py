"""Single-operator PIN session auth. Sessions are httpOnly cookies; no token in JSON."""

import os
import secrets
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, HTTPException, Response

from lib.db import db

COOKIE = "LEO_session"
TTL_DAYS = 30
_memory_sessions: dict[str, datetime] = {}


def _pin() -> str:
    return os.environ.get("LEO_PIN", "1903")


def _session_secret() -> bytes:
    return os.environ.get("LEO_SESSION_SECRET", "local-development-session-secret").encode()


def _fallback_token(expires_at: datetime) -> str:
    payload = f"{int(expires_at.timestamp())}.{secrets.token_urlsafe(16)}"
    signature = hmac.new(_session_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return f"fallback.{payload}.{signature}"


def _valid_fallback_token(token: str) -> bool:
    try:
        prefix, expiry, nonce, signature = token.split(".", 3)
        payload = f"{expiry}.{nonce}"
        expected = hmac.new(_session_secret(), payload.encode(), hashlib.sha256).hexdigest()
        return prefix == "fallback" and hmac.compare_digest(signature, expected) and int(expiry) > int(time.time())
    except (ValueError, TypeError):
        return False


async def create_session(pin: str, response: Response) -> None:
    if pin != _pin():
        raise HTTPException(status_code=401, detail="Geçersiz erişim kodu.")
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=TTL_DAYS)
    try:
        await db.sessions.insert_one(
            {
                "token": token,
                "created_at": datetime.now(timezone.utc),
                "expires_at": expires_at,
            }
        )
    except Exception:
        token = _fallback_token(expires_at)
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        max_age=TTL_DAYS * 86400,
        samesite="lax",
        path="/",
        secure=bool(os.environ.get("VERCEL")),
    )


async def destroy_session(response: Response, token: str | None) -> None:
    if token:
        _memory_sessions.pop(token, None)
        try:
            await db.sessions.delete_one({"token": token})
        except Exception:
            pass
    response.delete_cookie(COOKIE, path="/")


async def require_session(LEO_session: str | None = Cookie(default=None)) -> str:
    if not LEO_session:
        raise HTTPException(status_code=401, detail="Oturum gerekli.")
    if _valid_fallback_token(LEO_session):
        return LEO_session
    memory_expiry = _memory_sessions.get(LEO_session)
    if memory_expiry is not None:
        if memory_expiry > datetime.now(timezone.utc):
            return LEO_session
        _memory_sessions.pop(LEO_session, None)
    try:
        doc = await db.sessions.find_one({"token": LEO_session})
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(status_code=401, detail="Oturum geçersiz veya süresi dolmuş.")
    return LEO_session
