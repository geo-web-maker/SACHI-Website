from pydantic import BaseModel, ConfigDict, Field

from app.models.common import PyObjectId


class GalleryPhotoOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    caption: str
    image_url: str | None = None  # None until real upload/storage (R2, etc.) is wired up


class GalleryPhotoCreate(BaseModel):
    caption: str = "Untitled photo"
    image_url: str | None = None


class GalleryPhotoUpdate(BaseModel):
    caption: str | None = None
