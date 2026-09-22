from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from app.api.wines import router as wines_router

app = FastAPI(title="VinoScope API")
app.include_router(wines_router, prefix="/api")
