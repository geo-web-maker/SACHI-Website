from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.common import PyObjectId

MIN_PASSWORD_LENGTH = 8


def _validate_password_length(value: str) -> str:
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    return value


class AdminUserOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    name: str
    email: EmailStr
    # Optional on read: pre-existing accounts (e.g. the seeded super_admin)
    # were created before phone/must_change_password existed.
    phone: str | None = None
    role: str
    must_change_password: bool = False


class AdminUserCreateResult(AdminUserOut):
    sms_sent: bool


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str
    phone: str  # required — this is where the temp password gets texted


class AdminUserUpdate(BaseModel):
    role: str | None = None
    name: str | None = None
    phone: str | None = None


class PasswordResetResult(BaseModel):
    sms_sent: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    _check_password = field_validator("new_password")(_validate_password_length)


class MeOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    sections: list[str]
    must_change_password: bool = False
