import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from app.core.database import get_database
from app.core.images import (
    fetch_many,
    image_extension,
    merge_images,
    safe_name,
    sha256_hex,
    zip_response,
)
from app.deps import require_edit, require_view
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
    # None = the file says nothing about photos, so existing photos are left untouched.
    images: list[ProgrammeImage] | None = None


class ProgrammeImportPayload(BaseModel):
    programmes: list[ProgrammeImportRow]
    # False (default): photos already in the system but absent from the file are kept.
    remove_unlisted_images: bool = False


class ProgrammeImportResult(BaseModel):
    created: int
    updated: int
    errors: list[str]
    photos_matched: int = 0  # recognised as already in the system: caption updated, no re-upload
    photos_added: int = 0
    photos_removed: int = 0


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
      (title, icon, teaser, body are overwritten). Photos are merged: a photo
      recognised as already in the system (same SHA-256, else same URL) only has
      its caption updated; new photos are added; see merge_images().
    - If the slug does not exist a new programme is created and assigned
      the next sequential number.
    - Each row is processed independently; a failure on one row is recorded
      in ``errors`` and processing continues.
    """
    created = updated = 0
    stats = {"matched": 0, "added": 0, "removed": 0}
    errors: list[str] = []

    for row in body.programmes:
        try:
            existing = await db.programmes.find_one({"slug": row.slug})
            incoming = [img.model_dump() for img in row.images] if row.images is not None else None
            fields = {"title": row.title, "icon": row.icon, "teaser": row.teaser, "body": row.body}

            if existing:
                if incoming is not None:
                    merged, st = merge_images(
                        existing.get("images", []), incoming, body.remove_unlisted_images
                    )
                    fields["images"] = merged
                    for k in stats:
                        stats[k] += st[k]
                await db.programmes.update_one({"slug": row.slug}, {"$set": fields})
                updated += 1
            else:
                count = await db.programmes.count_documents({})
                merged, st = merge_images([], incoming or [])
                for k in stats:
                    stats[k] += st[k]
                await db.programmes.insert_one(
                    {"slug": row.slug, "num": str(count + 1).zfill(2), **fields, "images": merged}
                )
                created += 1

        except Exception as exc:  # noqa: BLE001
            errors.append(f"{row.slug}: {exc}")

    return ProgrammeImportResult(
        created=created,
        updated=updated,
        errors=errors,
        photos_matched=stats["matched"],
        photos_added=stats["added"],
        photos_removed=stats["removed"],
    )


# ── Bulk caption update ────────────────────────────────────────────────────


class CaptionRow(BaseModel):
    slug: str
    image_id: str
    caption: str


class CaptionBulkPayload(BaseModel):
    rows: list[CaptionRow] = Field(max_length=5000)


class CaptionBulkResult(BaseModel):
    updated: int
    unchanged: int
    not_found: list[str]


@router.post(
    "/api/admin/programmes/captions/bulk",
    response_model=CaptionBulkResult,
    dependencies=[Depends(require_edit("programmes"))],
)
async def bulk_update_captions(
    body: CaptionBulkPayload, db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update only the caption of existing photos, matched by (slug, image id).

    Unlike /import this never touches titles, body text, image order or URLs.
    """
    by_slug: dict[str, dict[str, str]] = {}
    for r in body.rows:
        by_slug.setdefault(r.slug, {})[r.image_id] = r.caption

    updated = unchanged = 0
    not_found: list[str] = []
    for slug, wanted in by_slug.items():
        doc = await db.programmes.find_one({"slug": slug}, {"images": 1})
        if doc is None:
            not_found.extend(f"{slug}/{iid}" for iid in wanted)
            continue
        images = doc.get("images", [])
        known = {img["id"] for img in images}
        not_found.extend(f"{slug}/{iid}" for iid in wanted if iid not in known)
        changed = False
        for img in images:
            if img["id"] in wanted:
                if img.get("caption") == wanted[img["id"]]:
                    unchanged += 1
                else:
                    img["caption"] = wanted[img["id"]]
                    updated += 1
                    changed = True
        if changed:
            await db.programmes.update_one({"slug": slug}, {"$set": {"images": images}})
    return CaptionBulkResult(updated=updated, unchanged=unchanged, not_found=not_found)


# ── Full export (ZIP with real images) ─────────────────────────────────────


@router.get("/api/admin/programmes/export.zip", dependencies=[Depends(require_view("programmes"))])
async def export_programmes_zip(db: AsyncIOMotorDatabase = Depends(get_database)):
    """programmes.json + captions.csv + the actual image files (not links).

    The ZIP can be fed straight back into Import: photos are recognised by
    SHA-256, so unchanged pictures are not re-uploaded and only captions/text update.
    """
    docs = await db.programmes.find().sort("num", 1).to_list(length=None)
    urls = [img["image_url"] for d in docs for img in d.get("images", []) if img.get("image_url")]
    fetched = await fetch_many(urls)

    files: list[tuple[str, bytes]] = []
    warnings: list[str] = []
    out: list[dict] = []
    rows = [["slug", "image_id", "caption", "programme_title", "image_file", "sha256"]]

    for d in docs:
        images = []
        for n, img in enumerate(d.get("images", []), 1):
            entry = {"id": img["id"], "caption": img["caption"]}
            url = img.get("image_url")
            if url:
                res = fetched.get(url)
                if res is not None and res.data is not None:
                    digest = sha256_hex(res.data)
                    path = f"images/{d['slug']}/{n:02d}-{safe_name(img['id'])}{image_extension(url, res.content_type)}"
                    files.append((path, res.data))
                    entry.update(image_url=path, sha256=digest)
                    if img.get("sha256") != digest:
                        await db.programmes.update_one(
                            {"_id": d["_id"]},
                            {"$set": {"images.$[img].sha256": digest}},
                            array_filters=[{"img.id": img["id"]}],
                        )
                else:
                    # Could not download: keep the link so a re-import still works, and say so.
                    entry["image_url"] = url
                    if img.get("sha256"):
                        entry["sha256"] = img["sha256"]
                    warnings.append(f"{d['slug']}/{img['id']}: not exported as a file ({res.error if res else 'unknown'}); link kept")
            images.append(entry)
            rows.append([d["slug"], img["id"], img["caption"], d["title"], entry.get("image_url", ""), entry.get("sha256", "")])
        out.append(
            {"slug": d["slug"], "icon": d["icon"], "title": d["title"], "teaser": d["teaser"], "body": d["body"], "images": images}
        )

    buf = io.StringIO()
    csv.writer(buf, lineterminator="\r\n").writerows(rows)
    files.insert(0, ("programmes.json", json.dumps(out, indent=2, ensure_ascii=False).encode("utf-8")))
    files.insert(1, ("captions.csv", ("\ufeff" + buf.getvalue()).encode("utf-8")))
    if warnings:
        files.insert(2, ("export-warnings.txt", "\n".join(warnings).encode("utf-8")))
    return zip_response(files, "sachi-programmes.zip")
