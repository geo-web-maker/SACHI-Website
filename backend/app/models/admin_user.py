from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.common import ASSIGNABLE_SECTIONS, PyObjectId


class SectionPermission(BaseModel):
    """A single section's grant for one admin. `edit` implies `view` — enforced
    in admin_users.py rather than here, so a bad payload gets a clear 400 instead
    of silently losing the edit grant."""

    view: bool = False
    edit: bool = False


PermissionMap = dict[str, SectionPermission]


class AdminUserOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(validation_alias="_id")
    name: str
    email: EmailStr
    is_super_admin: bool = False
    permissions: PermissionMap = Field(default_factory=dict)
    phone: str = ""
    is_active: bool = True  # absent on older docs -> treated as active


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str  # where the generated temp password gets SMS'd
    is_super_admin: bool = False
    permissions: PermissionMap = Field(default_factory=dict)


class AdminUserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    is_super_admin: bool | None = None
    permissions: PermissionMap | None = None  # full replace when provided, not a merge


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
    is_super_admin: bool = False
    permissions: PermissionMap = Field(default_factory=dict)
    must_change_password: bool = False


def full_access_permissions() -> PermissionMap:
    """super_admins aren't stored with an explicit permissions doc (they don't
    need one), but the frontend still wants a permissions map to render — this
    synthesizes an all-true one for MeOut. Assembled from ASSIGNABLE_SECTIONS so
    it can't drift from the section list."""
    return {section: SectionPermission(view=True, edit=True) for section in ASSIGNABLE_SECTIONS}
