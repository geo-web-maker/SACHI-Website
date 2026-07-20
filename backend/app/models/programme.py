from pydantic import BaseModel, ConfigDict, Field

from app.models.common import PyObjectId


class ProgrammeImage(BaseModel):
    id: str
    caption: str
    image_url: str | None = None   # added


class ProgrammeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    slug: str
    icon: str
    num: str
    title: str
    teaser: str
    body: list[str]
    images: list[ProgrammeImage]


class ProgrammeCreate(BaseModel):
    slug: str
    icon: str
    num: str
    title: str
    teaser: str
    body: list[str]
    images: list[ProgrammeImage] = []


class ProgrammeUpdate(BaseModel):
    """Matches the fields ProgrammesAdmin.jsx actually edits: teaser, body, images."""

    teaser: str | None = None
    body: list[str] | None = None
    images: list[ProgrammeImage] | None = None
