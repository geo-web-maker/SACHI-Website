from pydantic import BaseModel, ConfigDict, Field

from app.models.common import PyObjectId

JOB_TYPES = ["Freelance", "Full Time", "Internship", "Part Time", "Temporary"]


class JobOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    title: str
    type: str
    location: str
    remote: bool
    keywords: str = ""
    status: str = "Open"  # "Open" | "Closed"
    description: str = ""  # HTML, authored via the RichTextEditor


class JobCreate(BaseModel):
    title: str
    type: str
    location: str
    remote: bool = False
    keywords: str = ""
    description: str = ""


class JobUpdate(BaseModel):
    status: str | None = None  # used by the "Close role / Reopen" toggle
    title: str | None = None
    type: str | None = None
    location: str | None = None
    remote: bool | None = None
    keywords: str | None = None
    description: str | None = None
