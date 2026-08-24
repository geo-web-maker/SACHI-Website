from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.database import get_database
from app.deps import require_section
from app.models.job import JOB_TYPES, JobCreate, JobOut, JobUpdate
from app.models.job_application import JobApplicationCreate, JobApplicationOut, JobApplicationUpdate

router = APIRouter(tags=["jobs"])


@router.get("/api/jobs", response_model=list[JobOut])
async def list_open_jobs(
    keyword: str = Query("", description="Matches title or keywords"),
    location: str = Query(""),
    remote_only: bool = Query(False),
    types: list[str] = Query(default=JOB_TYPES, description="Repeat as ?types=Full+Time&types=Internship"),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    query: dict = {"status": "Open", "type": {"$in": types}}

    if keyword.strip():
        query["$or"] = [
            {"title": {"$regex": keyword.strip(), "$options": "i"}},
            {"keywords": {"$regex": keyword.strip(), "$options": "i"}},
        ]
    if location.strip():
        query["location"] = {"$regex": location.strip(), "$options": "i"}
    if remote_only:
        query["remote"] = True

    docs = await db.jobs.find(query).to_list(length=None)
    return docs


@router.get("/api/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    doc = await db.jobs.find_one({"_id": ObjectId(job_id), "status": "Open"})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return doc


@router.get(
    "/api/admin/jobs",
    response_model=list[JobOut],
    dependencies=[Depends(require_section("career"))],
)
async def list_all_jobs(db: AsyncIOMotorDatabase = Depends(get_database)):
    docs = await db.jobs.find().to_list(length=None)
    return docs


@router.post("/api/jobs/{job_id}/apply", response_model=JobApplicationOut, status_code=status.HTTP_201_CREATED)
async def submit_application(
    job_id: str, body: JobApplicationCreate, db: AsyncIOMotorDatabase = Depends(get_database)
):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    job = await db.jobs.find_one({"_id": ObjectId(job_id), "status": "Open"})
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    doc = {
        **body.model_dump(),
        "job_id": job_id,
        "job_title": job["title"],
        "status": "New",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.job_applications.insert_one(doc)
    return await db.job_applications.find_one({"_id": result.inserted_id})


@router.get(
    "/api/admin/jobs/applications",
    response_model=list[JobApplicationOut],
    dependencies=[Depends(require_section("career"))],
)
async def list_applications(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await db.job_applications.find().sort("created_at", -1).to_list(length=None)


@router.patch(
    "/api/admin/jobs/applications/{application_id}",
    response_model=JobApplicationOut,
    dependencies=[Depends(require_section("career"))],
)
async def update_application(
    application_id: str,
    body: JobApplicationUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid id")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    doc = await db.job_applications.find_one_and_update(
        {"_id": ObjectId(application_id)}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return doc


@router.post(
    "/api/admin/jobs",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_section("career"))],
)
async def create_job(body: JobCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    doc = {**body.model_dump(), "status": "Open"}
    result = await db.jobs.insert_one(doc)
    return await db.jobs.find_one({"_id": result.inserted_id})


@router.patch(
    "/api/admin/jobs/{job_id}",
    response_model=JobOut,
    dependencies=[Depends(require_section("career"))],
)
async def update_job(job_id: str, body: JobUpdate, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid job id")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    doc = await db.jobs.find_one_and_update(
        {"_id": ObjectId(job_id)}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return doc


@router.delete(
    "/api/admin/jobs/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_section("career"))],
)
async def delete_job(job_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid job id")
    await db.jobs.delete_one({"_id": ObjectId(job_id)})
