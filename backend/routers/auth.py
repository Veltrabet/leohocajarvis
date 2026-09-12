from fastapi import APIRouter, Cookie, Depends, Response

from lib.activity import log
from lib.auth import COOKIE, create_session, destroy_session, require_session
from models.schemas import Me, PinLogin

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Me)
async def login(body: PinLogin, response: Response):
    await create_session(body.pin, response)
    await log("oturum", "Operatör sisteme giriş yaptı.")
    return Me(authenticated=True, operator="LeoHoca")


@router.get("/me", response_model=Me)
async def me(_: str = Depends(require_session)):
    return Me(authenticated=True, operator="LeoHoca")


@router.post("/logout", response_model=Me)
async def logout(response: Response, jarvis_session: str | None = Cookie(default=None)):
    await destroy_session(response, jarvis_session)
    return Me(authenticated=False, operator="")


__all__ = ["router", "COOKIE"]
