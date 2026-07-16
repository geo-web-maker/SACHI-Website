from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.common import PyObjectId


class DonationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    donor: str
    amount: int  # UGX, smallest whole unit — no decimals in the mock data
    type: str  # "One-time" | "Monthly"
    method: str  # "Mobile Money" | "Bank Transfer"
    created_at: datetime


class DonationCreate(BaseModel):
    """Public endpoint stub — real fields will expand once Pesapal/Flutterwave
    payment integration is wired up (matches the eCRMS-style payment research
    already done for other clients)."""

    donor: str = "Anonymous"
    amount: int
    type: str = "One-time"
    method: str = "Mobile Money"
