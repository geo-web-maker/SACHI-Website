from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.common import PyObjectId


class ContactSubmissionCreate(BaseModel):
    name: str
    email: EmailStr
    subject: str = ""
    message: str


class ContactSubmissionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    name: str
    email: EmailStr
    subject: str
    message: str
    status: str = "New"  # "New" | "Read"
    created_at: datetime


class ContactSubmissionUpdate(BaseModel):
    status: str | None = None
