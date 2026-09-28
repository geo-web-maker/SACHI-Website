from bson import ObjectId
from fastapi import Cookie, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.security import decode_access_token
from app.models.common import PermissionLevel, user_has_access

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
    if not user.get("is_active", True):
        # Checked on every request (not just at login) so disabling someone
        # kills their existing session immediately, rather than waiting out
        # the JWT's expiry.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account has been disabled")

    return user


def require_section(section: str, level: PermissionLevel = "view"):
    """Use as a route dependency: Depends(require_section('donations')) for a
    read endpoint, or Depends(require_section('donations', 'edit')) for a
    write one. This is the server-side enforcement that ProtectedSection.jsx
    (frontend) explicitly calls out as missing in the demo — the UI hint alone
    was never real access control. Scope-based: access comes from the user's own
    `permissions` grant (or super_admin status), not from a role preset."""

    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if not user_has_access(user, section, level):
            verb = "view" if level == "view" else "edit"
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"You don't have {verb} access to '{section}'")
        return user

    return checker


def require_view(section: str):
    return require_section(section, "view")


def require_edit(section: str):
    return require_section(section, "edit")


def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin only")
    return user
