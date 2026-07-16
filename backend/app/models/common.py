from typing import Annotated

from bson import ObjectId
from pydantic import BeforeValidator

# Lets Pydantic accept a Mongo ObjectId and serialize it back out as a plain string,
# so every response model can just declare `id: PyObjectId | None = Field(alias="_id")`.
PyObjectId = Annotated[str, BeforeValidator(str)]


def validate_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise ValueError("Invalid ObjectId")
    return ObjectId(value)


# Mirrors src/admin/data/roles.js — keep these two in sync by hand.
# This is the server-side source of truth; the frontend copy is just for UI rendering.
ROLES: dict[str, list[str]] = {
    "super_admin": ["dashboard", "programmes", "career", "gallery", "contact", "donations", "users"],
    "content_manager": ["dashboard", "programmes", "gallery"],
    "hr_manager": ["dashboard", "career"],
    "comms_manager": ["dashboard", "contact"],
    "finance_viewer": ["dashboard", "donations"],
}

ROLE_LABELS: dict[str, str] = {
    "super_admin": "Super Admin",
    "content_manager": "Content Manager",
    "hr_manager": "HR Manager",
    "comms_manager": "Comms Manager",
    "finance_viewer": "Finance Viewer",
}


def role_has_section(role: str, section: str) -> bool:
    return section in ROLES.get(role, [])
