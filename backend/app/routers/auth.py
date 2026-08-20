from fastapi import APIRouter, Depends, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.database import get_database
from app.core.rate_limit import check_login_rate_limit, clear_login_attempts, record_failed_login
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import COOKIE_NAME, get_current_user
from app.models.admin_user import ChangePasswordRequest, LoginRequest, MeOut
from app.models.common import ROLES

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Used to run verify_password() even when the email doesn't exist, so a
# failed login takes roughly the same time either way (no timing signal
# for "does this email exist").
_DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeOgOX3lPXNMHqQBqO6E0K0O8Uz8j0cCLW"


def _to_me_out(user: dict) -> MeOut:
    return MeOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        sections=ROLES.get(user["role"], []),
        must_change_password=user.get("must_change_password", False),
    )


@router.post("/login", response_model=MeOut)
async def login(body: LoginRequest, response: Response, db: AsyncIOMotorDatabase = Depends(get_database)):
    key = body.email.lower()
    await check_login_rate_limit(db, key)

    user = await db.admin_users.find_one({"email": body.email})
    password_ok = verify_password(body.password, user["password_hash"] if user else _DUMMY_HASH)
    if user is None or not password_ok:
        await record_failed_login(db, key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    await clear_login_attempts(db, key)

    token = create_access_token(subject=str(user["_id"]), role=user["role"])
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="none",   # was "lax" — required for cross-site (Vercel → Render) cookies
        max_age=settings.jwt_expire_minutes * 60,
    )

    return _to_me_out(user)


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
    return _to_me_out(user)


@router.post("/change-password", response_model=MeOut)
async def change_password(
    body: ChangePasswordRequest,
    user: dict = Depends(get_current_user),  # not require_password_current — this must stay
    # reachable precisely when must_change_password is true.
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not verify_password(body.old_password, user.get("password_hash", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect")

    await db.admin_users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "must_change_password": False}},
    )
    user["must_change_password"] = False
    return _to_me_out(user)
