from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin_key
from app.schemas.wine import WineDetail, WineListResponse, WineUpdate
from app.services import wines as wines_service
from app.services.wines import SortOption

router = APIRouter()


@router.get("/wines", response_model=WineListResponse)
def list_wines(
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    q: Optional[str] = None,
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
        q=q,
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


@router.patch("/wines/{wine_id}", response_model=WineDetail, dependencies=[Depends(require_admin_key)])
def update_wine(wine_id: int, body: WineUpdate, db: Session = Depends(get_db)) -> WineDetail:
    updates = body.model_dump(exclude_unset=True)

    if "winery" in updates:
        winery_name = updates.pop("winery")
        winery = wines_service.get_winery_by_name(db, winery_name)
        if winery is None:
            raise HTTPException(status_code=404, detail="Winery not found")
        updates["winery_id"] = winery.id

    result = wines_service.update_wine(db, wine_id, updates)
    if result is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return WineDetail(**result)
