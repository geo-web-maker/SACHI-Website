from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import close_client, ensure_indexes
from app.routers import admin_users, auth, contact, dashboard, donations, gallery, jobs, programmes, uploads

CSRF_HEADER = "X-Sachi-Csrf"
CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # cookie_secure=True is how we already signal "this is a real deployment"
    # (see config.py). If that's on but the JWT secret is still the dev
    # default, every session token is forgeable — refuse to start.
    if settings.cookie_secure and settings.jwt_secret == "dev-secret-change-me":
        raise RuntimeError(
            "Refusing to start: COOKIE_SECURE is true (production mode) but JWT_SECRET is "
            "still the default dev value. Set a strong JWT_SECRET env var on Render."
        )
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
app.include_router(uploads.router)
app.include_router(programmes.router)
app.include_router(jobs.router)
app.include_router(gallery.router)
app.include_router(contact.router)
app.include_router(donations.router)
app.include_router(admin_users.router)
app.include_router(dashboard.router)


# CSRF defense-in-depth: a plain HTML <form> (the classic CSRF vector) can't
# set a custom header, and a cross-origin fetch/XHR that tries to would need
# a CORS preflight — which only succeeds for origins in CORS_ORIGINS above.
# So requiring this header on every state-changing request blocks both.
# NOTE: if a real payment webhook (Pesapal/Flutterwave etc.) is wired into
# /api/donations later, it must be exempted here (webhooks can't set this
# header) and secured a different way — e.g. verifying the provider's
# signature header instead.
@app.middleware("http")
async def require_csrf_header(request: Request, call_next):
    if request.method not in CSRF_SAFE_METHODS and request.headers.get(CSRF_HEADER) != "1":
        return JSONResponse(status_code=403, content={"detail": "Missing CSRF header"})
    return await call_next(request)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
