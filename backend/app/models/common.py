from typing import Annotated, Literal

from bson import ObjectId
from pydantic import BeforeValidator

# Lets Pydantic accept a Mongo ObjectId and serialize it back out as a plain string,
# so every response model can just declare `id: PyObjectId | None = Field(alias="_id")`.
PyObjectId = Annotated[str, BeforeValidator(str)]


def validate_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise ValueError("Invalid ObjectId")
    return ObjectId(value)


# Scope-based access control. Every non-super-admin gets an explicit, per-section
# {view, edit} grant assigned by a super_admin (app/routers/admin_users.py) — there
# is no longer a fixed "role" that bundles a preset list of sections. "dashboard" is
# always viewable by any signed-in admin and isn't part of this matrix; "users" (admin
# management) is reachable by super_admins only, also outside this matrix.
# Mirrors src/admin/data/sections.js — keep the two ASSIGNABLE_SECTIONS lists in sync.
ASSIGNABLE_SECTIONS: list[str] = ["programmes", "career", "gallery", "contact", "donations"]

PermissionLevel = Literal["view", "edit"]


def user_has_access(user: dict, section: str, level: PermissionLevel = "view") -> bool:
    """True if `user` (a raw admin_users doc, or the dict from get_current_user)
    can access `section` at `level`. super_admins can access everything; everyone
    else needs an explicit grant in their `permissions` dict. `edit` implies `view`
    is also granted (enforced on write in admin_users.py), so checking either is safe."""
    if user.get("is_super_admin"):
        return True
    grant = user.get("permissions", {}).get(section, {})
    return bool(grant.get(level, False))
