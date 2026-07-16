from bson import ObjectId
from fastapi import Cookie, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.security import decode_access_token
from app.models.common import role_has_section

COOKIE_NAME = "sachi_session"


async def get_current_user(
    sachi_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    if sachi_session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")

    payload = decode_access_token(sachi_session)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired or invalid")

    user = await db.admin_users.find_one({"_id": ObjectId(payload["sub"])})
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists")

    return user


def require_section(section: str):
    """Use as a route dependency: Depends(require_section('donations')).

    This is the server-side enforcement that ProtectedSection.jsx (frontend)
    explicitly calls out as missing in the demo — the UI hint alone was never
    real access control.
    """

    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if not role_has_section(user["role"], section):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your role can't access '{section}'")
        return user

    return checker


def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin only")
    return user
