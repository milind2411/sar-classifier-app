"""
SAR Vessel/Iceberg Classifier API — FastAPI entrypoint.

Run locally with:
    uvicorn main:app --reload --port 8000

Then visit http://localhost:8000/docs for interactive API docs.
"""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from logging_config import setup_logging, get_logger
from routers import predict as predict_router
from gradcam import GradCamService
from limiter import limiter

# Initialize structured logging to stdout
setup_logging()
logger = get_logger("main")


def _prewarm_gradcam():
    """Background task to load TensorFlow and Keras model without blocking startup."""
    logger.info("[Grad-CAM] Background pre-warming started...")
    try:
        GradCamService._ensure_loaded()
        logger.info("[Grad-CAM] Background pre-warming finished.")
    except Exception as e:
        logger.error(f"[Grad-CAM] Background pre-warming failed: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kick off GradCamService._ensure_loaded() in a background thread on startup
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _prewarm_gradcam)
    yield


app = FastAPI(
    title="SAR Vessel/Iceberg Classifier API",
    description="Dual-branch ResNet50 SAR classifier — ship vs iceberg detection from Sentinel-1 chips.",
    version="1.0.0",
    lifespan=lifespan,
)

def _custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Log rate limit rejections as WARNING with endpoint details (anonymized/no raw IP)."""
    logger.warning("Rate limit exceeded on endpoint: %s (limit: %s)", request.url.path, exc.detail)
    return _rate_limit_exceeded_handler(request, exc)


async def _custom_validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Sanitize validation error messages to:
    1. Avoid echoing massive band arrays (e.g. 5625 floats) back in the response.
    2. Prevent Starlette JSONResponse crashes (ValueError) on non-compliant floats (NaN/Inf) in 'input'.
    3. Return clean, descriptive 422 error details.
    """
    sanitized_errors = []
    for error in exc.errors():
        err_dict = {k: v for k, v in error.items() if k != "input"}
        sanitized_errors.append(err_dict)
    encoded = jsonable_encoder(sanitized_errors)
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, encoded)
    return JSONResponse(status_code=422, content={"detail": encoded})

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _custom_rate_limit_handler)
app.add_exception_handler(RequestValidationError, _custom_validation_exception_handler)
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def log_errors_middleware(request: Request, call_next):
    """Capture and log 4xx client errors as WARNING and 5xx server errors as ERROR."""
    response = await call_next(request)
    if response.status_code >= 500:
        logger.error("HTTP %d server error on %s %s", response.status_code, request.method, request.url.path)
    elif response.status_code >= 400 and response.status_code != 429:
        logger.warning("HTTP %d client error on %s %s", response.status_code, request.method, request.url.path)
    return response


# CORS: Configurable via ALLOWED_ORIGINS env var (comma-separated list of origins).
# Defaults to standard local development frontend ports (Vite 5173, React 3000).
# In production, set ALLOWED_ORIGINS to the real deployed frontend domain(s).
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router.router, prefix="/api", tags=["prediction"])


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
