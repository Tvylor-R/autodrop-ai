from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import logging

from app.database.models import User
from app.database.store_model import Store
from app.database.product_model import Product
from app.database.webhook_models import Order, InventoryLevel
from app.routers.shopify import router as shopify_router
from app.routers.users import router as user_router
from app.routers.products import router as product_router
from app.routers.ai import router as ai_router
from app.routers.webhooks import router as webhooks_router
from app.routers.store_data import router as store_data_router
from app.routers.actions import router as actions_router
from app.routers.bulk_import import router as bulk_import_router
from app.routers.health import router as health_router
from app.routers.analytics import router as analytics_router
from app.core.middleware import (
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title="AutoDrop AI API",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(user_router)
app.include_router(shopify_router)
app.include_router(product_router)
app.include_router(ai_router)
app.include_router(webhooks_router)
app.include_router(store_data_router)
app.include_router(actions_router)
app.include_router(bulk_import_router)
app.include_router(health_router)
app.include_router(analytics_router)


@app.get("/")
async def home():
    return {
        "message": "Welcome to AutoDrop AI",
        "docs": "/docs",
        "health": "/health",
    }