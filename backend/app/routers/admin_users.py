from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.database import get_database
from app.core.security import hash_password
from app.deps import require_super_admin
from app.models.admin_user import AdminUserCreate, AdminUserOut, AdminUserUpdate
from app.models.common import ROLES

router = APIRouter(
    prefix="/api/admin/users", tags=["admin-users"], dependencies=[Depends(require_super_admin)]
)


@router.get("", response_model=list[AdminUserOut])
async def list_users(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.admin_users.find().to_list(length=None)


@router.post("", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: AdminUserCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    if body.role not in ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown role '{body.role}'")

    doc = {
        "name": body.name,
        "email": body.email,
        "role": body.role,
        "password_hash": hash_password(body.password),
    }
    try:
        result = await db.admin_users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with that email already exists")
    return await db.admin_users.find_one({"_id": result.inserted_id})


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


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user id")
    await db.admin_users.delete_one({"_id": ObjectId(user_id)})
