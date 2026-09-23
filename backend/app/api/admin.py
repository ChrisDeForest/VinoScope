from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin_key
from app.schemas.admin import AdminStats
from app.services import admin as admin_service

router = APIRouter()


@router.get("/admin/stats", response_model=AdminStats, dependencies=[Depends(require_admin_key)])
def get_stats(db: Session = Depends(get_db)) -> AdminStats:
    return AdminStats(**admin_service.get_stats(db))
