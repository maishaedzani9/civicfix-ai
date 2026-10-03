from contextlib import asynccontextmanager
from uuid import uuid4
import logging

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.environment == "production" and (settings.demo_mode or not settings.authentication_configured
        or not settings.supabase_url or not settings.supabase_service_key):
        raise RuntimeError("Production requires Supabase authentication and private evidence storage; demo mode must be disabled.")
    if settings.demo_mode:
        if settings.environment != "demo" or len(settings.demo_jwt_secret) < 32 or not settings.database_url.startswith("sqlite+"):
            raise RuntimeError("Demo requires environment=demo, an isolated SQLite database and a secret of at least 32 characters.")
        from app.demo import initialize
        from app.db import engine, SessionFactory
        await initialize(engine, SessionFactory)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.4.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)
app.include_router(router)
from app.workflows import router as workflow_router
app.include_router(workflow_router)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": {
        "code": f"http_{exc.status_code}", "message": str(exc.detail),
        "request_id": getattr(request.state, "request_id", ""), "details": []}})


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    details = [{"field": ".".join(str(v) for v in e["loc"]), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"error": {"code": "validation_error",
        "message": "Check the report fields.", "request_id": getattr(request.state, "request_id", ""), "details": details}})



@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid4().hex}"
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception as exc:
        logging.getLogger("civicfix").error("Request %s failed (%s)", request_id, type(exc).__name__)
        response = JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "An unexpected error occurred.", "request_id": request_id, "details": []}},
        )
    response.headers["X-Request-ID"] = request_id
    return response
