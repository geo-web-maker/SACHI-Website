"""One-off migration: run this ONCE against the live database after deploying
the RichTextEditor changes, to convert existing `programmes.body` documents
from a list[str] of paragraphs into a single HTML string.

BACK UP THE `programmes` COLLECTION BEFORE RUNNING THIS. It is safe to run
more than once (it skips documents whose body is already a string), but a
backup costs nothing and a bad migration on live data costs a lot.

Usage:
    cd backend
    python -m scripts.migrate_programme_body

Reads MONGO_URI / MONGO_DB the same way the app does — adjust the import
below if your app.core.database module exposes the client differently.
"""

import asyncio

from app.core.database import get_database


async def main():
    db = get_database()

    migrated = 0
    skipped = 0

    async for doc in db.programmes.find({}):
        body = doc.get("body")

        if isinstance(body, list):
            html = "".join(f"<p>{para}</p>" for para in body)
            await db.programmes.update_one({"_id": doc["_id"]}, {"$set": {"body": html}})
            migrated += 1
            print(f"migrated: {doc.get('slug')}")
        elif isinstance(body, str):
            skipped += 1
        else:
            print(f"WARNING: unexpected body type for {doc.get('slug')}: {type(body)}")

    print(f"\nDone. Migrated {migrated}, already-migrated/skipped {skipped}.")


if __name__ == "__main__":
    asyncio.run(main())
