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
    AdminUserCreateOut,
    AdminUserOut,
    AdminUserUpdate,
    TempPasswordDelivery,
)
from app.models.common import ROLES

router = APIRouter(
    prefix="/api/admin/users", tags=["admin-users"], dependencies=[Depends(require_super_admin)]
)


@router.get("", response_model=list[AdminUserOut])
async def list_users(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.admin_users.find().to_list(length=None)


@router.post("", response_model=AdminUserCreateOut, status_code=status.HTTP_201_CREATED)
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
    return AdminUserCreateOut(
        **created,
        sms_sent=sms_sent,
        temp_password=None if sms_sent else temp_password,
    )


@router.patch("/{user_id}", response_model=AdminUserOut)
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


async def _is_last_active_super_admin(db: AsyncIOMotorDatabase, user_id: ObjectId) -> bool:
    """True if `user_id` is a super_admin and no other active super_admin exists.
    Docs without an `is_active` key are treated as active (pre-migration default)."""
    remaining = await db.admin_users.count_documents(
        {
            "_id": {"$ne": user_id},
            "role": "super_admin",
            "is_active": {"$ne": False},
        }
    )
    return remaining == 0


@router.post("/{user_id}/reset-password", response_model=TempPasswordDelivery)
async def reset_password(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Sets a fresh random temp password and SMS's it to the user's phone —
    a dedicated action (not a PATCH with a `password` field) so it can't be
    bundled silently into an unrelated profile edit, and so the generated
    password — not an admin-typed one — is always what gets set. Falls back
    to returning the plaintext (once) only if the SMS send fails."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")

    temp_password = generate_temp_password()
    doc = await db.admin_users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": hash_password(temp_password), "must_change_password": True}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    sms_sent = False
    if doc.get("phone"):
        sms_sent = await send_temp_password_sms(doc["name"], doc["phone"], temp_password)
    return TempPasswordDelivery(
        id=str(doc["_id"]),
        sms_sent=sms_sent,
        temp_password=None if sms_sent else temp_password,
    )


@router.post("/{user_id}/disable", response_model=AdminUserOut)
async def disable_user(
    user_id: str,
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")
    if user_id == str(current_user["_id"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't disable your own account")

    target = await db.admin_users.find_one({"_id": ObjectId(user_id)})
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target["role"] == "super_admin" and await _is_last_active_super_admin(db, ObjectId(user_id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't disable the last active super admin")

    doc = await db.admin_users.find_one_and_update(
        {"_id": ObjectId(user_id)}, {"$set": {"is_active": False}}, return_document=ReturnDocument.AFTER
    )
    return doc


@router.post("/{user_id}/enable", response_model=AdminUserOut)
async def enable_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")
    doc = await db.admin_users.find_one_and_update(
        {"_id": ObjectId(user_id)}, {"$set": {"is_active": True}}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return doc


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")
    if user_id == str(current_user["_id"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't delete your own account")

    target = await db.admin_users.find_one({"_id": ObjectId(user_id)})
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target["role"] == "super_admin" and await _is_last_active_super_admin(db, ObjectId(user_id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't delete the last active super admin")

    await db.admin_users.delete_one({"_id": ObjectId(user_id)})
