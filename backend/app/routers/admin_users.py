from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.database import get_database
from app.core.security import hash_password
from app.core.sms import generate_temp_password, send_temp_password_sms
from app.deps import require_super_admin
from app.models.admin_user import (
    AdminUserCreate,
    AdminUserCreateResult,
    AdminUserOut,
    AdminUserUpdate,
    PasswordResetResult,
)
from app.models.common import ROLES

router = APIRouter(
    prefix="/api/admin/users", tags=["admin-users"], dependencies=[Depends(require_super_admin)]
)


@router.get("", response_model=list[AdminUserOut], response_model_by_alias=False)
async def list_users(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.admin_users.find().to_list(length=None)


@router.post("", response_model=AdminUserCreateResult, response_model_by_alias=False, status_code=status.HTTP_201_CREATED)
async def create_user(body: AdminUserCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    if body.role not in ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown role '{body.role}'")

    temp_password = generate_temp_password()
    doc = {
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "role": body.role,
        "password_hash": hash_password(temp_password),
        "must_change_password": True,
    }
    try:
        result = await db.admin_users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with that email already exists")

    sms_sent = await send_temp_password_sms(body.name, body.phone, temp_password)
    created = await db.admin_users.find_one({"_id": result.inserted_id})
    return {**created, "sms_sent": sms_sent}


@router.patch("/{user_id}", response_model=AdminUserOut, response_model_by_alias=False)
async def update_user(user_id: str, body: AdminUserUpdate, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")
    if body.role is not None and body.role not in ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown role '{body.role}'")

    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    doc = await db.admin_users.find_one_and_update(
        {"_id": ObjectId(user_id)}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return doc


@router.patch("/{user_id}/password", response_model=PasswordResetResult)
async def reset_password(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Generates a fresh temp password, texts it to the user's phone on
    file, and flags the account so the next login forces a password
    change — same flow as new-account creation."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")

    user = await db.admin_users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if not user.get("phone"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account has no phone number on file — add one via edit before resetting.",
        )

    temp_password = generate_temp_password()
    await db.admin_users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(temp_password), "must_change_password": True}},
    )
    sms_sent = await send_temp_password_sms(user["name"], user["phone"], temp_password)
    return {"sms_sent": sms_sent}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")
    await db.admin_users.delete_one({"_id": ObjectId(user_id)})
