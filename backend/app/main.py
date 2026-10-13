import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR, settings
from .database import Base, SessionLocal, engine
from .routes import auth, branches, inquiries, memberships, metrics, public
from .seed import ensure_admin, seed_sample_data

logging.basicConfig(level=logging.INFO)

CSP = (
    "default-src 'self'; "
    "script-src 'self' https://cdn.jsdelivr.net; "
    "style-src 'self' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data: https://images.pexels.com; "
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)  # use Alembic migrations for schema changes in production
    with SessionLocal() as db:
        ensure_admin(db)
        if settings.seed_sample_data:
            seed_sample_data(db)
    yield


app = FastAPI(
    title="Kinetra API",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.enable_api_docs else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.enable_api_docs else None,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    path = request.url.path
    if path.startswith(("/api/admin", "/api/auth")):
        response.headers["Cache-Control"] = "no-store"
    if path.startswith("/admin"):
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


for router in (public.router, auth.router, branches.router, inquiries.router, memberships.router, metrics.router):
    app.include_router(router)


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def api_not_found(rest: str):
    return JSONResponse({"detail": "Not found"}, status_code=404)


# Static frontend (public site at /, admin at /admin/). Mounted last so /api wins.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
