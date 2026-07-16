from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.database import get_database
from app.deps import require_section
from app.models.gallery import GalleryPhotoCreate, GalleryPhotoOut, GalleryPhotoUpdate

router = APIRouter(tags=["gallery"])


@router.get("/api/gallery", response_model=list[GalleryPhotoOut])
async def list_photos(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.gallery_photos.find().to_list(length=None)


@router.post(
    "/api/admin/gallery",
    response_model=GalleryPhotoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_section("gallery"))],
)
async def add_photo(body: GalleryPhotoCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    result = await db.gallery_photos.insert_one(body.model_dump())
    return await db.gallery_photos.find_one({"_id": result.inserted_id})


@router.patch(
    "/api/admin/gallery/{photo_id}",
    response_model=GalleryPhotoOut,
    dependencies=[Depends(require_section("gallery"))],
)
async def update_photo(
    photo_id: str, body: GalleryPhotoUpdate, db: AsyncIOMotorDatabase = Depends(get_database)
):
    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid photo id")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    doc = await db.gallery_photos.find_one_and_update(
        {"_id": ObjectId(photo_id)}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    return doc


@router.delete(
    "/api/admin/gallery/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_section("gallery"))],
)
async def remove_photo(photo_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid photo id")
    await db.gallery_photos.delete_one({"_id": ObjectId(photo_id)})
