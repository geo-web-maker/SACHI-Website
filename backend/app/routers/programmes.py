from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.database import get_database
from app.deps import require_section
from app.models.programme import ProgrammeCreate, ProgrammeOut, ProgrammeUpdate

router = APIRouter(tags=["programmes"])


@router.get("/api/programmes", response_model=list[ProgrammeOut])
async def list_programmes(db: AsyncIOMotorDatabase = Depends(get_database)):
    docs = await db.programmes.find().sort("num", 1).to_list(length=None)
    return docs


@router.get("/api/programmes/{slug}", response_model=ProgrammeOut)
async def get_programme(slug: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    doc = await db.programmes.find_one({"slug": slug})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Programme not found")
    return doc


@router.post(
    "/api/admin/programmes",
    response_model=ProgrammeOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_section("programmes"))],
)
async def create_programme(body: ProgrammeCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    existing = await db.programmes.find_one({"slug": body.slug})
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A programme with that slug already exists")

    count = await db.programmes.count_documents({})
    num = str(count + 1).zfill(2)

    doc = {**body.model_dump(), "num": num}
    result = await db.programmes.insert_one(doc)
    return await db.programmes.find_one({"_id": result.inserted_id})

@router.patch(
    "/api/admin/programmes/{slug}",
    response_model=ProgrammeOut,
    dependencies=[Depends(require_section("programmes"))],
)
async def update_programme(
    slug: str, body: ProgrammeUpdate, db: AsyncIOMotorDatabase = Depends(get_database)
):
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if body.images is not None:
        changes["images"] = [img.model_dump() for img in body.images]
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    result = await db.programmes.find_one_and_update(
        {"slug": slug}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Programme not found")
    return result
