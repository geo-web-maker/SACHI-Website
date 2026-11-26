from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument, UpdateOne

from app.core.database import get_database
from app.deps import require_edit
from app.models.gallery import (
    CaptionBulkResult,
    CaptionBulkUpdate,
    GalleryPhotoCreate,
    GalleryPhotoOut,
    GalleryPhotoUpdate,
)

router = APIRouter(tags=["gallery"])


@router.get("/api/gallery", response_model=list[GalleryPhotoOut])
async def list_photos(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.gallery_photos.find().to_list(length=None)


@router.post(
    "/api/admin/gallery",
    response_model=GalleryPhotoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_edit("gallery"))],
)
async def add_photo(body: GalleryPhotoCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    result = await db.gallery_photos.insert_one(body.model_dump())
    return await db.gallery_photos.find_one({"_id": result.inserted_id})


@router.post(
    "/api/admin/gallery/captions/bulk",
    response_model=CaptionBulkResult,
    dependencies=[Depends(require_edit("gallery"))],
)
async def bulk_update_captions(
    body: CaptionBulkUpdate, db: AsyncIOMotorDatabase = Depends(get_database)
):
    invalid = [i.id for i in body.items if not ObjectId.is_valid(i.id)]
    valid = [i for i in body.items if ObjectId.is_valid(i.id)]
    if not valid:
        return CaptionBulkResult(updated=0, unchanged=0, not_found=[], invalid_ids=invalid)

    existing = {
        d["_id"]: d.get("caption")
        async for d in db.gallery_photos.find(
            {"_id": {"$in": [ObjectId(i.id) for i in valid]}}, {"caption": 1}
        )
    }
    ops, not_found, unchanged = [], [], 0
    for item in valid:
        oid = ObjectId(item.id)
        if oid not in existing:
            not_found.append(item.id)
        elif existing[oid] == item.caption:
            unchanged += 1
        else:
            ops.append(UpdateOne({"_id": oid}, {"$set": {"caption": item.caption}}))
    if ops:
        await db.gallery_photos.bulk_write(ops, ordered=False)
    return CaptionBulkResult(
        updated=len(ops), unchanged=unchanged, not_found=not_found, invalid_ids=invalid
    )


@router.patch(
    "/api/admin/gallery/{photo_id}",
    response_model=GalleryPhotoOut,
    dependencies=[Depends(require_edit("gallery"))],
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
    dependencies=[Depends(require_edit("gallery"))],
)
async def remove_photo(photo_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid photo id")
    await db.gallery_photos.delete_one({"_id": ObjectId(photo_id)})
