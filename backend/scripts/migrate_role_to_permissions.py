"""One-off migration: run this ONCE against the live database after deploying
the scope-based permissions change, to convert existing `admin_users` documents
from the old fixed `role` string (super_admin / content_manager / hr_manager /
comms_manager / finance_viewer) into the new `is_super_admin` bool +
per-section `permissions` dict.

BACK UP THE `admin_users` COLLECTION BEFORE RUNNING THIS. It is safe to run
more than once (it skips documents that already have a `permissions` key), but
a backup costs nothing and a bad migration on live data costs a lot.

Usage:
    cd backend
    python -m scripts.migrate_role_to_permissions

Reads MONGO_URI / MONGO_DB the same way the app does — adjust the import
below if your app.core.database module exposes the client differently.
"""

import asyncio

from app.core.database import get_database

# Snapshot of the old role -> sections mapping (deleted from app/models/common.py
# now that access is scope-based). Kept here only so this one-off migration can
# translate old docs; do not resurrect this as a live mapping elsewhere.
OLD_ROLE_SECTIONS: dict[str, list[str]] = {
    "super_admin": ["programmes", "career", "gallery", "contact", "donations"],
    "content_manager": ["programmes", "gallery"],
    "hr_manager": ["career"],
    "comms_manager": ["contact"],
    "finance_viewer": ["donations"],
}


def permissions_for_old_role(role: str) -> dict:
    sections = OLD_ROLE_SECTIONS.get(role, [])
    return {section: {"view": True, "edit": True} for section in sections}


async def main():
    db = get_database()

    migrated = 0
    skipped = 0

    async for doc in db.admin_users.find({}):
        if "permissions" in doc:
            skipped += 1
            continue

        old_role = doc.get("role", "")
        is_super_admin = old_role == "super_admin"
        permissions = {} if is_super_admin else permissions_for_old_role(old_role)

        await db.admin_users.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {"is_super_admin": is_super_admin, "permissions": permissions},
                "$unset": {"role": ""},
            },
        )
        migrated += 1
        print(f"migrated: {doc.get('email')} (was role={old_role!r}) -> is_super_admin={is_super_admin}, permissions={permissions}")

    print(f"\nDone. Migrated {migrated}, already-migrated/skipped {skipped}.")
    if migrated:
        print(
            "\nEvery admin's old sections were granted both view AND edit, matching what "
            "they could already do before. Go to Admin > Users to fine-tune anyone down to "
            "view-only where that's now wanted."
        )


if __name__ == "__main__":
    asyncio.run(main())
