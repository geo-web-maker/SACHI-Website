from fastapi import APIRouter, Depends, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.database import get_database
from app.core.security import create_access_token, verify_password
from app.deps import COOKIE_NAME, get_current_user
from app.models.admin_user import LoginRequest, MeOut
from app.models.common import ROLES

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=MeOut)
async def login(body: LoginRequest, response: Response, db: AsyncIOMotorDatabase = Depends(get_database)):
    user = await db.admin_users.find_one({"email": body.email})
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    token = create_access_token(subject=str(user["_id"]), role=user["role"])
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
    )

    return MeOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        sections=ROLES.get(user["role"], []),
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(user: dict = Depends(get_current_user)):
    return MeOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        sections=ROLES.get(user["role"], []),
    )
