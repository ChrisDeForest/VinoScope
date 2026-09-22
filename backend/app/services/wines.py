from typing import Literal, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery

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


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _grapes_for_wine(db: Session, wine_id: int) -> list[dict]:
    stmt = (
        select(Grape.name, WineGrape.percentage)
        .join(WineGrape, WineGrape.grape_id == Grape.id)
        .where(WineGrape.wine_id == wine_id)
        .order_by(WineGrape.percentage.desc().nulls_last(), Grape.name)
    )
    rows = db.execute(stmt).all()
    return [{"name": name, "percentage": pct} for name, pct in rows]


def _grapes_for_wines(db: Session, wine_ids: list[int]) -> dict[int, list[dict]]:
    if not wine_ids:
        return {}
    stmt = (
        select(WineGrape.wine_id, Grape.name, WineGrape.percentage)
        .join(Grape, Grape.id == WineGrape.grape_id)
        .where(WineGrape.wine_id.in_(wine_ids))
        .order_by(WineGrape.wine_id, WineGrape.percentage.desc().nulls_last(), Grape.name)
    )
    rows = db.execute(stmt).all()
    result: dict[int, list[dict]] = {wid: [] for wid in wine_ids}
    for wine_id, name, pct in rows:
        result[wine_id].append({"name": name, "percentage": pct})
    return result


def _row_to_dict(wine: Wine, winery_name: str, min_price: Optional[float], grapes: list[dict]) -> dict:
    return {
        "id": wine.id,
        "name": wine.name,
        "winery": winery_name,
        "vintage": wine.vintage,
        "type": wine.type,
        "country": wine.country,
        "region": wine.region,
        "grapes": grapes,
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
    q: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: SortOption = "winery",
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[dict]]:
    price_sq = _min_price_subquery()

    stmt = (
        select(Wine, Winery.name.label("winery_name"), price_sq.c.min_price)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
    )

    if type is not None:
        stmt = stmt.where(func.lower(Wine.type) == type.lower())
    if country is not None:
        stmt = stmt.where(func.lower(Wine.country) == country.lower())
    if grape is not None:
        stmt = stmt.where(
            Wine.id.in_(
                select(WineGrape.wine_id)
                .join(Grape, Grape.id == WineGrape.grape_id)
                .where(Grape.name.ilike(f"%{_escape_like(grape)}%", escape="\\"))
            )
        )
    if q is not None:
        pattern = f"%{_escape_like(q)}%"
        stmt = stmt.where(or_(Wine.name.ilike(pattern, escape="\\"), Winery.name.ilike(pattern, escape="\\")))
    if min_price is not None:
        stmt = stmt.where(price_sq.c.min_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(price_sq.c.min_price <= max_price)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    if sort == "price_asc":
        stmt = stmt.order_by(price_sq.c.min_price.asc().nulls_last(), Wine.id)
    elif sort == "price_desc":
        stmt = stmt.order_by(price_sq.c.min_price.desc().nulls_last(), Wine.id)
    elif sort == "vintage":
        stmt = stmt.order_by(Wine.vintage.asc().nulls_last(), Wine.id)
    else:
        stmt = stmt.order_by(Winery.name.asc(), Wine.id)

    rows = db.execute(stmt.offset(offset).limit(limit)).all()
    wine_ids = [wine.id for wine, _, _ in rows]
    grapes_by_wine = _grapes_for_wines(db, wine_ids)
    items = [
        _row_to_dict(wine, winery_name, min_price_val, grapes_by_wine.get(wine.id, []))
        for wine, winery_name, min_price_val in rows
    ]
    return total, items


def get_wine(db: Session, wine_id: int) -> Optional[dict]:
    price_sq = _min_price_subquery()
    stmt = (
        select(Wine, Winery.name.label("winery_name"), price_sq.c.min_price)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
        .where(Wine.id == wine_id)
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        return None
    wine, winery_name, min_price_val = row

    listing_stmt = (
        select(RetailerListing, Retailer.name.label("retailer_name"))
        .join(Retailer, RetailerListing.retailer_id == Retailer.id)
        .where(RetailerListing.wine_id == wine_id)
    )
    listing_rows = db.execute(listing_stmt).all()

    grapes = _grapes_for_wine(db, wine_id)
    data = _row_to_dict(wine, winery_name, min_price_val, grapes)
    data["subregion"] = wine.subregion
    data["abv"] = wine.abv
    data["description"] = wine.description
    data["listings"] = [
        {
            "retailer": retailer_name,
            "price": listing.price,
            "currency": listing.currency,
            "product_url": listing.product_url,
            "availability": listing.availability,
        }
        for listing, retailer_name in listing_rows
    ]
    return data
