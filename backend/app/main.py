from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import close_client, ensure_indexes
from app.routers import admin_users, auth, contact, dashboard, donations, gallery, jobs, programmes


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    yield
    await close_client()


app = FastAPI(title="SACHI API", lifespan=lifespan)

# credentials: 'include' on the frontend requires explicit origins here — '*' won't work
# alongside cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(programmes.router)
app.include_router(jobs.router)
app.include_router(gallery.router)
app.include_router(contact.router)
app.include_router(donations.router)
app.include_router(admin_users.router)
app.include_router(dashboard.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
