"""Single-operator PIN session auth. Sessions are httpOnly cookies; no token in JSON."""

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, HTTPException, Response

from lib.db import db

COOKIE = "jarvis_session"
TTL_DAYS = 30
_memory_sessions: dict[str, datetime] = {}


def _pin() -> str:
    return os.environ.get("JARVIS_PIN", "1903")


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
        _memory_sessions[token] = expires_at
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        max_age=TTL_DAYS * 86400,
        samesite="lax",
        path="/",
        secure=False,
    )


async def destroy_session(response: Response, token: str | None) -> None:
    if token:
        _memory_sessions.pop(token, None)
        try:
            await db.sessions.delete_one({"token": token})
        except Exception:
            pass
    response.delete_cookie(COOKIE, path="/")


async def require_session(jarvis_session: str | None = Cookie(default=None)) -> str:
    if not jarvis_session:
        raise HTTPException(status_code=401, detail="Oturum gerekli.")
    memory_expiry = _memory_sessions.get(jarvis_session)
    if memory_expiry is not None:
        if memory_expiry > datetime.now(timezone.utc):
            return jarvis_session
        _memory_sessions.pop(jarvis_session, None)
    try:
        doc = await db.sessions.find_one({"token": jarvis_session})
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(status_code=401, detail="Oturum geçersiz veya süresi dolmuş.")
    return jarvis_session
