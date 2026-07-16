from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri)
    return _client


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency — inject with `db = Depends(get_database)`."""
    return get_client()[settings.mongo_db_name]


async def ensure_indexes() -> None:
    """Called once on startup. Add new indexes here as collections grow."""
    db = get_database()
    await db.admin_users.create_index("email", unique=True)
    await db.programmes.create_index("slug", unique=True)
    await db.jobs.create_index([("title", "text"), ("keywords", "text")])
    await db.contact_submissions.create_index("created_at")
    await db.donations.create_index("created_at")


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
