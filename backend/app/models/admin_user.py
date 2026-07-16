from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.common import PyObjectId


class AdminUserOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    name: str
    email: EmailStr
    role: str


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str
    password: str  # super_admin sets a temp password; add invite-link flow later if needed


class AdminUserUpdate(BaseModel):
    role: str | None = None
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MeOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    sections: list[str]
