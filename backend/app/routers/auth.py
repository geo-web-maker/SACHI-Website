from fastapi import APIRouter, Depends, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.database import get_database
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import COOKIE_NAME, get_current_user
from app.models.admin_user import ChangePasswordRequest, LoginRequest, MeOut, SectionPermission, full_access_permissions

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _me_out(user: dict, must_change_password: bool | None = None) -> MeOut:
    """Builds MeOut from a raw admin_users doc. super_admins don't store an
    explicit permissions doc (they don't need one) — synthesize an all-true
    map here so the frontend always has a permissions object to read."""
    if user.get("is_super_admin"):
        permissions = full_access_permissions()
    else:
        permissions = {
            section: SectionPermission(**perm) for section, perm in user.get("permissions", {}).items()
        }
    return MeOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        is_super_admin=user.get("is_super_admin", False),
        permissions=permissions,
        must_change_password=(
            user.get("must_change_password", False) if must_change_password is None else must_change_password
        ),
    )


@router.post("/login", response_model=MeOut)
async def login(body: LoginRequest, response: Response, db: AsyncIOMotorDatabase = Depends(get_database)):
    user = await db.admin_users.find_one({"email": body.email})
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.get("is_active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account has been disabled")

    token = create_access_token(subject=str(user["_id"]))
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="none",   # was "lax" — required for cross-site (Vercel → Render) cookies
        max_age=settings.jwt_expire_minutes * 60,
    )

    return _me_out(user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        COOKIE_NAME,
        samesite="none",     # must match set_cookie or the browser won't clear it
        secure=settings.cookie_secure,
    )
    return {"ok": True}

@router.get("/me", response_model=MeOut)
async def me(user: dict = Depends(get_current_user)):
    return _me_out(user)


@router.post("/change-password", response_model=MeOut)
async def change_password(
    body: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Self-service — works for both the forced first-login change and any
    later voluntary one. Requires the current password so a session alone
    isn't enough to take over the account."""
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different from the current one")

    await db.admin_users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "must_change_password": False}},
    )
    return _me_out(user, must_change_password=False)
