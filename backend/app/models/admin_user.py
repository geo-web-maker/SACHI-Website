from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.common import PyObjectId


class AdminUserOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(validation_alias="_id")
    name: str
    email: EmailStr
    role: str
    phone: str = ""
    is_active: bool = True  # absent on older docs -> treated as active


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str  # where the generated temp password gets SMS'd
    role: str


class AdminUserUpdate(BaseModel):
    role: str | None = None
    name: str | None = None
    phone: str | None = None


class TempPasswordDelivery(BaseModel):
    """Returned by /reset-password. `temp_password` is only populated when
    the SMS send failed — the fallback for the caller to relay it manually.
    When `sms_sent` is true it is never included."""

    id: str
    sms_sent: bool
    temp_password: str | None = None


class AdminUserCreateOut(AdminUserOut):
    """AdminUserOut plus delivery status for the temp password that was
    generated and SMS'd on creation. Same never-include-plaintext-on-success
    rule as TempPasswordDelivery."""

    sms_sent: bool
    temp_password: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    """Self-service change, used both for the forced first-login gate and any
    later voluntary change. Requires the current password (not just a valid
    session) so a hijacked/left-open session can't be used to lock the real
    owner out."""

    current_password: str
    new_password: str = Field(min_length=8)


class MeOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    sections: list[str]
    must_change_password: bool = False
