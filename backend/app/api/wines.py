from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin_key
from app.models import Wine
from app.schemas.wine import (
    GrapesUpdate,
    RetailerListingCreate,
    RetailerListingOut,
    RetailerListingUpdate,
    WineDetail,
    WineListResponse,
    WineUpdate,
)
from app.services import wines as wines_service
from app.services.wines import SortOption
from app.validation import PRICE_RANGE_ERROR, price_range_invalid

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
    if price_range_invalid(min_price, max_price):
        raise HTTPException(status_code=422, detail=PRICE_RANGE_ERROR)
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
    if db.get(Wine, wine_id) is None:
        raise HTTPException(status_code=404, detail="Wine not found")

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


@router.post(
    "/wines/{wine_id}/listings",
    response_model=RetailerListingOut,
    status_code=201,
    dependencies=[Depends(require_admin_key)],
)
def create_listing(wine_id: int, body: RetailerListingCreate, db: Session = Depends(get_db)) -> RetailerListingOut:
    result = wines_service.create_listing(db, wine_id, body.model_dump())
    if result is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return RetailerListingOut(**result)


@router.patch(
    "/wines/{wine_id}/listings/{listing_id}",
    response_model=RetailerListingOut,
    dependencies=[Depends(require_admin_key)],
)
def update_listing(
    wine_id: int, listing_id: int, body: RetailerListingUpdate, db: Session = Depends(get_db)
) -> RetailerListingOut:
    updates = body.model_dump(exclude_unset=True)
    result = wines_service.update_listing(db, wine_id, listing_id, updates)
    if result is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return RetailerListingOut(**result)


@router.delete(
    "/wines/{wine_id}/listings/{listing_id}",
    status_code=204,
    dependencies=[Depends(require_admin_key)],
)
def delete_listing(wine_id: int, listing_id: int, db: Session = Depends(get_db)) -> None:
    deleted = wines_service.delete_listing(db, wine_id, listing_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Listing not found")


@router.put(
    "/wines/{wine_id}/grapes",
    response_model=WineDetail,
    dependencies=[Depends(require_admin_key)],
)
def update_grapes(wine_id: int, body: GrapesUpdate, db: Session = Depends(get_db)) -> WineDetail:
    result = wines_service.update_grapes(db, wine_id, [g.model_dump() for g in body.grapes])
    if result is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return WineDetail(**result)
