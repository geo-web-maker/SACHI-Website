from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

WINDOW_MINUTES = 15
MAX_ATTEMPTS = 5


async def check_login_rate_limit(db: AsyncIOMotorDatabase, key: str) -> None:
    """Raise 429 if `key` (lowercased email) has too many recent failed logins.

    Each failed attempt is its own document; a TTL index on `expires_at`
    (see ensure_indexes) cleans them up automatically.
    """
    window_start = datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MINUTES)
    count = await db.login_attempts.count_documents({"key": key, "created_at": {"$gte": window_start}})
    if count >= MAX_ATTEMPTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many failed login attempts. Try again in {WINDOW_MINUTES} minutes.",
        )


async def record_failed_login(db: AsyncIOMotorDatabase, key: str) -> None:
    now = datetime.now(timezone.utc)
    await db.login_attempts.insert_one(
        {"key": key, "created_at": now, "expires_at": now + timedelta(minutes=WINDOW_MINUTES)}
    )


async def clear_login_attempts(db: AsyncIOMotorDatabase, key: str) -> None:
    await db.login_attempts.delete_many({"key": key})
