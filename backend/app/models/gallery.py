from pydantic import BaseModel, ConfigDict, Field

from app.models.common import PyObjectId


class GalleryPhotoOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(validation_alias="_id")
    caption: str
    image_url: str | None = None  # None until real upload/storage (R2, etc.) is wired up
    sha256: str | None = None


class GalleryPhotoCreate(BaseModel):
    caption: str = "Untitled photo"
    image_url: str | None = None
    sha256: str | None = None


class GalleryPhotoUpdate(BaseModel):
    caption: str | None = None
    image_url: str | None = None   # added
    sha256: str | None = None


class CaptionBulkItem(BaseModel):
    id: str
    caption: str


class CaptionBulkUpdate(BaseModel):
    items: list[CaptionBulkItem] = Field(max_length=2000)


class CaptionBulkResult(BaseModel):
    updated: int
    unchanged: int
    not_found: list[str]
    invalid_ids: list[str]


class GalleryImportItem(BaseModel):
    caption: str = ""
    image_url: str | None = None
    sha256: str | None = None


class GalleryImportPayload(BaseModel):
    items: list[GalleryImportItem] = Field(max_length=1000)


class GalleryImportResult(BaseModel):
    created: int
    updated: int
    unchanged: int
    skipped: int = 0  # rows with neither a picture nor a hash
