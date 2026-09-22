from typing import Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Grape, RetailerListing, Wine, WineGrape, Winery

SortOption = Literal["price_asc", "price_desc", "vintage", "winery"]


def _min_price_subquery():
    return (
        select(
            RetailerListing.wine_id.label("wine_id"),
            func.min(RetailerListing.price).label("min_price"),
        )
        .group_by(RetailerListing.wine_id)
        .subquery()
    )


def _grapes_for_wine(db: Session, wine_id: int) -> list[dict]:
    rows = (
        db.query(Grape.name, WineGrape.percentage)
        .join(WineGrape, WineGrape.grape_id == Grape.id)
        .filter(WineGrape.wine_id == wine_id)
        .all()
    )
    rows = sorted(rows, key=lambda r: (r[1] is None, -(r[1] or 0)))
    return [{"name": name, "percentage": pct} for name, pct in rows]


def _row_to_dict(wine: Wine, winery_name: str, min_price: Optional[float], db: Session) -> dict:
    return {
        "id": wine.id,
        "name": wine.name,
        "winery": winery_name,
        "vintage": wine.vintage,
        "type": wine.type,
        "country": wine.country,
        "region": wine.region,
        "grapes": _grapes_for_wine(db, wine.id),
        "price": min_price,
        "image_url": wine.image_url,
        "sweetness": wine.sweetness,
        "acidity": wine.acidity,
        "tannin": wine.tannin,
        "body": wine.body,
        "fruitiness": wine.fruitiness,
    }


def list_wines(
    db: Session,
    *,
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: SortOption = "winery",
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[dict]]:
    price_sq = _min_price_subquery()

    query = (
        db.query(Wine, Winery.name.label("winery_name"), price_sq.c.min_price)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
    )

    if type is not None:
        query = query.filter(func.lower(Wine.type) == type.lower())
    if country is not None:
        query = query.filter(func.lower(Wine.country) == country.lower())
    if grape is not None:
        query = query.filter(
            Wine.id.in_(
                select(WineGrape.wine_id)
                .join(Grape, Grape.id == WineGrape.grape_id)
                .where(Grape.name.ilike(f"%{grape}%"))
            )
        )
    if min_price is not None:
        query = query.filter(price_sq.c.min_price >= min_price)
    if max_price is not None:
        query = query.filter(price_sq.c.min_price <= max_price)

    total = query.count()

    if sort == "price_asc":
        query = query.order_by(price_sq.c.min_price.asc().nulls_last(), Wine.id)
    elif sort == "price_desc":
        query = query.order_by(price_sq.c.min_price.desc().nulls_last(), Wine.id)
    elif sort == "vintage":
        query = query.order_by(Wine.vintage.asc().nulls_last(), Wine.id)
    else:
        query = query.order_by(Winery.name.asc(), Wine.id)

    rows = query.offset(offset).limit(limit).all()
    items = [_row_to_dict(wine, winery_name, min_price_val, db) for wine, winery_name, min_price_val in rows]
    return total, items
