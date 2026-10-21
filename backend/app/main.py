from dotenv import load_dotenv

load_dotenv()

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.wines import router as wines_router
from app.api.recommendations import router as recommendations_router


def api_docs_settings(env=os.environ):
    """The interactive docs and OpenAPI schema are for development; production hides them."""
    if env.get("VINOSCOPE_ENV") == "production":
        return {"docs_url": None, "redoc_url": None, "openapi_url": None}
    return {"docs_url": "/docs", "redoc_url": "/redoc", "openapi_url": "/openapi.json"}


app = FastAPI(title="VinoScope API", **api_docs_settings())

cors_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(wines_router, prefix="/api")
app.include_router(recommendations_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
