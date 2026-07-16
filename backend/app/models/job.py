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


class JobCreate(BaseModel):
    title: str
    type: str
    location: str
    remote: bool = False
    keywords: str = ""


class JobUpdate(BaseModel):
    status: str | None = None  # used by the "Close role / Reopen" toggle
