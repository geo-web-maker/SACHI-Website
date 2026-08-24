from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.common import PyObjectId


class JobApplicationCreate(BaseModel):
    applicant_name: str
    applicant_email: EmailStr
    phone: str = ""
    cover_note: str = ""
    resume_url: str  # Cloudinary raw-upload URL, obtained client-side before this POST


class JobApplicationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    job_id: str
    job_title: str  # denormalized at submission time, so admin list survives a role being edited/deleted later
    applicant_name: str
    applicant_email: EmailStr
    phone: str
    cover_note: str
    resume_url: str
    status: str = "New"  # "New" | "Reviewed"
    created_at: datetime


class JobApplicationUpdate(BaseModel):
    status: str | None = None
