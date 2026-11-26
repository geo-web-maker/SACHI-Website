import csv
import io
import json

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument, UpdateOne

from app.core.database import get_database
from app.core.images import fetch_many, image_extension, safe_name, sha256_hex, zip_response
from app.deps import require_edit, require_view
from app.models.gallery import (
    CaptionBulkResult,
    CaptionBulkUpdate,
    GalleryImportPayload,
    GalleryImportResult,
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


# ── Full export / import (ZIP with real images) ────────────────────────────


@router.get("/api/admin/gallery/export.zip", dependencies=[Depends(require_view("gallery"))])
async def export_gallery_zip(db: AsyncIOMotorDatabase = Depends(get_database)):
    """gallery.json + captions.csv + the actual image files (not links)."""
    docs = await db.gallery_photos.find().to_list(length=None)
    fetched = await fetch_many(d["image_url"] for d in docs if d.get("image_url"))

    files: list[tuple[str, bytes]] = []
    warnings: list[str] = []
    photos: list[dict] = []
    rows = [["id", "caption", "image_file", "sha256"]]

    for n, d in enumerate(docs, 1):
        entry = {"id": str(d["_id"]), "caption": d.get("caption", "")}
        url = d.get("image_url")
        if url:
            res = fetched.get(url)
            if res is not None and res.data is not None:
                digest = sha256_hex(res.data)
                path = f"images/{n:03d}-{safe_name(str(d['_id']))}{image_extension(url, res.content_type)}"
                files.append((path, res.data))
                entry.update(image_url=path, sha256=digest)
                if d.get("sha256") != digest:
                    await db.gallery_photos.update_one({"_id": d["_id"]}, {"$set": {"sha256": digest}})
            else:
                entry["image_url"] = url
                if d.get("sha256"):
                    entry["sha256"] = d["sha256"]
                warnings.append(f"{entry['id']}: not exported as a file ({res.error if res else 'unknown'}); link kept")
        photos.append(entry)
        rows.append([entry["id"], entry["caption"], entry.get("image_url", ""), entry.get("sha256", "")])

    buf = io.StringIO()
    csv.writer(buf, lineterminator="\r\n").writerows(rows)
    files.insert(0, ("gallery.json", json.dumps(photos, indent=2, ensure_ascii=False).encode("utf-8")))
    files.insert(1, ("captions.csv", ("\ufeff" + buf.getvalue()).encode("utf-8")))
    if warnings:
        files.insert(2, ("export-warnings.txt", "\n".join(warnings).encode("utf-8")))
    return zip_response(files, "sachi-gallery.zip")


@router.post(
    "/api/admin/gallery/import",
    response_model=GalleryImportResult,
    dependencies=[Depends(require_edit("gallery"))],
)
async def import_gallery(body: GalleryImportPayload, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Upsert photos by picture identity.

    A photo whose sha256 (else image_url) is already in the gallery is the same
    photo: only its caption is updated. Anything else is created. Photos that
    are in the gallery but not in the file are left alone.
    """
    hashes = [i.sha256 for i in body.items if i.sha256]
    urls = [i.image_url for i in body.items if i.image_url]
    pool: dict[tuple[str, str], list[dict]] = {}
    query = {"$or": [{"sha256": {"$in": hashes}}, {"image_url": {"$in": urls}}]}
    async for d in db.gallery_photos.find(query):
        if d.get("sha256"):
            pool.setdefault(("sha", d["sha256"]), []).append(d)
        if d.get("image_url"):
            pool.setdefault(("url", d["image_url"]), []).append(d)

    claimed: set = set()

    def take(key):
        for d in pool.get(key, []):
            if d["_id"] not in claimed:
                claimed.add(d["_id"])
                return d
        return None

    created = updated = unchanged = 0
    for item in body.items:
        doc = None
        if item.sha256:
            doc = take(("sha", item.sha256))
        if doc is None and item.image_url:
            doc = take(("url", item.image_url))
        if doc is not None:
            changes = {}
            if doc.get("caption") != item.caption:
                changes["caption"] = item.caption
            if item.sha256 and not doc.get("sha256"):
                changes["sha256"] = item.sha256
            if changes:
                await db.gallery_photos.update_one({"_id": doc["_id"]}, {"$set": changes})
            if "caption" in changes:
                updated += 1
            else:
                unchanged += 1
        else:
            await db.gallery_photos.insert_one(
                {"caption": item.caption or "Untitled photo", "image_url": item.image_url, "sha256": item.sha256}
            )
            created += 1
    return GalleryImportResult(created=created, updated=updated, unchanged=unchanged)
