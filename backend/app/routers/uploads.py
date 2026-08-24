import hashlib
import time

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.deps import get_current_user

router = APIRouter(prefix="/api/admin/uploads", tags=["uploads"])

# Folder is hardcoded, not client-supplied — this account also runs other
# projects, so nothing in the request body/query can redirect uploads
# elsewhere. Any authenticated admin can request a signature (upload itself
# isn't a DB mutation); the actual save is still gated per-section by the
# existing PATCH endpoints.
UPLOAD_FOLDER = "sachi"


@router.post("/cloudinary-signature")
async def get_cloudinary_signature(user: dict = Depends(get_current_user)):
    timestamp = int(time.time())

    params_to_sign = {
        "timestamp": timestamp,
        "folder": UPLOAD_FOLDER,
    }

    to_sign = "&".join(f"{k}={v}" for k, v in sorted(params_to_sign.items()))
    to_sign += settings.cloudinary_api_secret
    signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

    return {
        "signature": signature,
        "timestamp": timestamp,
        "api_key": settings.cloudinary_api_key,
        "cloud_name": settings.cloudinary_cloud_name,
        "folder": UPLOAD_FOLDER,
    }


# --- Public resume uploads (job applications) -------------------------------
# Deliberately a separate router with no auth: applicants aren't logged in.
# Scoped tightly to reduce abuse of an unauthenticated signing endpoint:
# its own folder, resource_type=raw (not image/video), and allowed_formats
# signed so Cloudinary itself rejects anything that isn't a resume format.

public_router = APIRouter(prefix="/api/uploads", tags=["uploads"])

RESUME_FOLDER = "sachi/job-applications"
RESUME_ALLOWED_FORMATS = "pdf,doc,docx"


@public_router.post("/resume-signature")
async def get_resume_upload_signature():
    timestamp = int(time.time())

    params_to_sign = {
        "timestamp": timestamp,
        "folder": RESUME_FOLDER,
        "allowed_formats": RESUME_ALLOWED_FORMATS,
    }

    to_sign = "&".join(f"{k}={v}" for k, v in sorted(params_to_sign.items()))
    to_sign += settings.cloudinary_api_secret
    signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

    return {
        "signature": signature,
        "timestamp": timestamp,
        "api_key": settings.cloudinary_api_key,
        "cloud_name": settings.cloudinary_cloud_name,
        "folder": RESUME_FOLDER,
        "allowed_formats": RESUME_ALLOWED_FORMATS,
    }
