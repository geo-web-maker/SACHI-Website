from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.database import get_database
from app.core.images import SHA256_RE, ensure_hashes
from app.deps import get_current_user
from app.models.common import user_has_access

router = APIRouter(prefix="/api/admin/images", tags=["media"])


class LookupBody(BaseModel):
    hashes: list[str] = Field(max_length=2000)


@router.post("/lookup")
async def lookup_images(
    body: LookupBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Which of these SHA-256 hashes are already in the system (programmes or gallery)?

    Returns {known: {sha256: image_url}} so the importer can reuse the existing
    hosted image instead of uploading the same picture again.
    """
    if not (user_has_access(user, "programmes", "edit") or user_has_access(user, "gallery", "edit")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have edit access to programmes or gallery")

    wanted = {h.lower() for h in body.hashes if SHA256_RE.match(h.lower())}
    if not wanted:
        return {"known": {}}

    await ensure_hashes(db)  # first call may take a while on old data; cached afterwards

    known: dict[str, str] = {}
    async for p in db.programmes.find({"images.sha256": {"$in": list(wanted)}}, {"images": 1}):
        for img in p.get("images", []):
            if img.get("sha256") in wanted and img.get("image_url"):
                known.setdefault(img["sha256"], img["image_url"])
    async for g in db.gallery_photos.find({"sha256": {"$in": list(wanted)}}, {"image_url": 1, "sha256": 1}):
        if g.get("image_url"):
            known.setdefault(g["sha256"], g["image_url"])
    return {"known": known}
