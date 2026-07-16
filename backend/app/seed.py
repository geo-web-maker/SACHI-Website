"""One-off data migration: run this once against a fresh database.

    python -m app.seed

It moves the placeholder data that currently lives in the frontend's
src/data/*.js and src/admin/data/mockData.js files into MongoDB, and creates
one super_admin account so you can log in for the first time. Change the
password immediately after.
"""

import asyncio
from datetime import datetime, timezone

from app.core.database import ensure_indexes, get_database
from app.core.security import hash_password

PROGRAMMES = [
    {
        "slug": "participatory-action-research",
        "icon": "Search",
        "num": "01",
        "title": "Participatory Action Research",
        "teaser": (
            "Where we collaborate with community members and stakeholders to identify local "
            "health problems, design investigations, and implement practical health solutions."
        ),
        "body": [
            "Where we collaborate with community members and stakeholders to identify local "
            "health problems, design investigations and implement practical health solutions.",
            "For example, during a cholera outbreak, we work with slum dwellers to explore how "
            "the outbreak impacts their local community.",
        ],
        "images": [
            {"id": "participatory-action-research-1", "caption": "Community data review session"},
            {"id": "participatory-action-research-2", "caption": "Stakeholder workshop"},
        ],
    },
    # ... add the remaining programmes from src/data/programmes.js the same way
]

JOBS = [
    {
        "title": "Community Health Officer",
        "type": "Full Time",
        "location": "Kyambogo, Kampala",
        "remote": False,
        "keywords": "community health outreach field",
        "status": "Open",
    },
    {
        "title": "WASH Field Coordinator",
        "type": "Full Time",
        "location": "Field-based, Uganda",
        "remote": False,
        "keywords": "wash water sanitation field coordinator",
        "status": "Open",
    },
    {
        "title": "Grant Writer",
        "type": "Freelance",
        "location": "Remote",
        "remote": True,
        "keywords": "grant writing proposals fundraising",
        "status": "Open",
    },
    # ... add the rest from src/data/jobs.js
]


async def main():
    db = get_database()
    await ensure_indexes()

    if await db.programmes.count_documents({}) == 0:
        await db.programmes.insert_many(PROGRAMMES)
        print(f"Inserted {len(PROGRAMMES)} programmes")

    if await db.jobs.count_documents({}) == 0:
        await db.jobs.insert_many(JOBS)
        print(f"Inserted {len(JOBS)} jobs")

    existing_admin = await db.admin_users.find_one({"email": "admin@sachiuganda.org"})
    if existing_admin is None:
        await db.admin_users.insert_one(
            {
                "name": "SACHI Super Admin",
                "email": "admin@sachiuganda.org",
                "role": "super_admin",
                "password_hash": hash_password("change-me-immediately"),
            }
        )
        print("Created super_admin: admin@sachiuganda.org / change-me-immediately")


if __name__ == "__main__":
    asyncio.run(main())
