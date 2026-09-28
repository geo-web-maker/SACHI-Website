from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.deps import get_current_user
from app.models.common import user_has_access

router = APIRouter(prefix="/api/admin/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(
    user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)
):
    stats: dict = {}

    if user_has_access(user, "programmes"):
        stats["programme_count"] = await db.programmes.count_documents({})

    if user_has_access(user, "career"):
        stats["open_job_count"] = await db.jobs.count_documents({"status": "Open"})

    if user_has_access(user, "contact"):
        stats["new_message_count"] = await db.contact_submissions.count_documents({"status": "New"})

    if user_has_access(user, "donations"):
        donations = await db.donations.find().to_list(length=None)
        stats["total_donations"] = sum(d["amount"] for d in donations)

    return stats
