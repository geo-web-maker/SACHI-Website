from fastapi import APIRouter, Depends, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.database import get_database
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import COOKIE_NAME, get_current_user
from app.models.admin_user import ChangePasswordRequest, LoginRequest, MeOut
from app.models.common import ROLES

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=MeOut)
async def login(body: LoginRequest, response: Response, db: AsyncIOMotorDatabase = Depends(get_database)):
    user = await db.admin_users.find_one({"email": body.email})
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.get("is_active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account has been disabled")

    token = create_access_token(subject=str(user["_id"]), role=user["role"])
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="none",   # was "lax" — required for cross-site (Vercel → Render) cookies
        max_age=settings.jwt_expire_minutes * 60,
    )

    return MeOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        sections=ROLES.get(user["role"], []),
        must_change_password=user.get("must_change_password", False),
    )


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
    return MeOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        sections=ROLES.get(user["role"], []),
        must_change_password=user.get("must_change_password", False),
    )


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
    return MeOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        sections=ROLES.get(user["role"], []),
        must_change_password=False,
    )
