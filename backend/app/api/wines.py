from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.wine import WineDetail, WineListResponse
from app.services import wines as wines_service
from app.services.wines import SortOption

router = APIRouter()


@router.get("/wines", response_model=WineListResponse)
def list_wines(
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    sort: SortOption = "winery",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> WineListResponse:
    total, items = wines_service.list_wines(
        db,
        type=type,
        country=country,
        grape=grape,
        min_price=min_price,
        max_price=max_price,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return WineListResponse(total=total, items=items)


@router.get("/wines/{wine_id}", response_model=WineDetail)
def get_wine(wine_id: int, db: Session = Depends(get_db)) -> WineDetail:
    wine = wines_service.get_wine(db, wine_id)
    if wine is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return WineDetail(**wine)
