from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from pymongo import ReturnDocument

from app.core.database import get_database
from app.deps import require_edit
from app.models.programme import ProgrammeCreate, ProgrammeImage, ProgrammeOut, ProgrammeUpdate

router = APIRouter(tags=["programmes"])


# ── Public endpoints ───────────────────────────────────────────────────────


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


# ── Admin endpoints ────────────────────────────────────────────────────────


@router.post(
    "/api/admin/programmes",
    response_model=ProgrammeOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_edit("programmes"))],
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
    dependencies=[Depends(require_edit("programmes"))],
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


# ── Bulk import ────────────────────────────────────────────────────────────


class ProgrammeImportRow(BaseModel):
    """One row in a bulk-import payload.  Matches the shape exported by the frontend."""

    slug: str
    icon: str
    title: str
    teaser: str = ""
    body: str = ""
    images: list[ProgrammeImage] = []


class ProgrammeImportPayload(BaseModel):
    programmes: list[ProgrammeImportRow]


class ProgrammeImportResult(BaseModel):
    created: int
    updated: int
    errors: list[str]


@router.post(
    "/api/admin/programmes/import",
    response_model=ProgrammeImportResult,
    dependencies=[Depends(require_edit("programmes"))],
)
async def import_programmes(
    body: ProgrammeImportPayload, db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Upsert a list of programmes by slug.

    - If a programme with the given slug already exists it is updated
      (title, icon, teaser, body, images are all overwritten).
    - If the slug does not exist a new programme is created and assigned
      the next sequential number.
    - Each row is processed independently; a failure on one row is recorded
      in ``errors`` and processing continues.
    """
    created = 0
    updated = 0
    errors: list[str] = []

    for row in body.programmes:
        try:
            existing = await db.programmes.find_one({"slug": row.slug})

            if existing:
                # Update all importable fields (title included, unlike the
                # regular PATCH which only updates icon/teaser/body/images).
                await db.programmes.update_one(
                    {"slug": row.slug},
                    {
                        "$set": {
                            "title": row.title,
                            "icon": row.icon,
                            "teaser": row.teaser,
                            "body": row.body,
                            "images": [img.model_dump() for img in row.images],
                        }
                    },
                )
                updated += 1
            else:
                count = await db.programmes.count_documents({})
                num = str(count + 1).zfill(2)
                await db.programmes.insert_one(
                    {
                        "slug": row.slug,
                        "num": num,
                        "title": row.title,
                        "icon": row.icon,
                        "teaser": row.teaser,
                        "body": row.body,
                        "images": [img.model_dump() for img in row.images],
                    }
                )
                created += 1

        except Exception as exc:  # noqa: BLE001
            errors.append(f"{row.slug}: {exc}")

    return ProgrammeImportResult(created=created, updated=updated, errors=errors)
