from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.database import get_database
from app.deps import require_section
from app.models.contact import ContactSubmissionCreate, ContactSubmissionOut, ContactSubmissionUpdate

router = APIRouter(tags=["contact"])


@router.post("/api/contact", response_model=ContactSubmissionOut, status_code=status.HTTP_201_CREATED)
async def submit_contact_form(
    body: ContactSubmissionCreate, db: AsyncIOMotorDatabase = Depends(get_database)
):
    doc = {**body.model_dump(), "status": "New", "created_at": datetime.now(timezone.utc)}
    result = await db.contact_submissions.insert_one(doc)
    return await db.contact_submissions.find_one({"_id": result.inserted_id})


@router.get(
    "/api/admin/contact",
    response_model=list[ContactSubmissionOut],
    dependencies=[Depends(require_section("contact"))],
)
async def list_submissions(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.contact_submissions.find().sort("created_at", -1).to_list(length=None)


@router.patch(
    "/api/admin/contact/{submission_id}",
    response_model=ContactSubmissionOut,
    dependencies=[Depends(require_section("contact"))],
)
async def update_submission(
    submission_id: str,
    body: ContactSubmissionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid id")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    doc = await db.contact_submissions.find_one_and_update(
        {"_id": ObjectId(submission_id)}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    return doc
