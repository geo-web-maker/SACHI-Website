from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.deps import require_section
from app.models.donation import DonationCreate, DonationOut

router = APIRouter(tags=["donations"])


@router.post("/api/donations", response_model=DonationOut)
async def record_donation(body: DonationCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Stub for now — records intent only. Swap in a real Pesapal/Flutterwave
    confirmation webhook before trusting this as a completed payment."""
    doc = {**body.model_dump(), "created_at": datetime.now(timezone.utc)}
    result = await db.donations.insert_one(doc)
    return await db.donations.find_one({"_id": result.inserted_id})


@router.get(
    "/api/admin/donations",
    response_model=list[DonationOut],
    dependencies=[Depends(require_section("donations"))],
)
async def list_donations(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.donations.find().sort("created_at", -1).to_list(length=None)


@router.get(
    "/api/admin/donations/stats",
    dependencies=[Depends(require_section("donations"))],
)
async def donation_stats(db: AsyncIOMotorDatabase = Depends(get_database)):
    donations = await db.donations.find().to_list(length=None)
    total = sum(d["amount"] for d in donations)
    monthly_donors = sum(1 for d in donations if d["type"] == "Monthly")
    avg_gift = round(total / len(donations)) if donations else 0
    return {"total": total, "monthly_donors": monthly_donors, "avg_gift": avg_gift}
