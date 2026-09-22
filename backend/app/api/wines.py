from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.wine import WineListResponse
from app.services import wines as wines_service

router = APIRouter()


@router.get("/wines", response_model=WineListResponse)
def list_wines(
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    sort: Literal["price_asc", "price_desc", "vintage", "winery"] = "winery",
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
