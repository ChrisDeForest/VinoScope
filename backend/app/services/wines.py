from datetime import datetime, timezone
from typing import Literal, Optional

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery
from app.services.currency import CURRENCY_RATES, approx_usd

SortOption = Literal["price_asc", "price_desc", "vintage", "winery"]


def _rate_case():
    return case(
        {code: rate for code, rate in CURRENCY_RATES.items()},
        value=func.upper(RetailerListing.currency),
        else_=1.0,
    )


def _cheapest_listing_subquery():
    usd_price = (RetailerListing.price * _rate_case()).label("usd_price")
    ranked = (
        select(
            RetailerListing.wine_id.label("wine_id"),
            RetailerListing.price.label("price"),
            RetailerListing.currency.label("currency"),
            usd_price,
            func.row_number()
            .over(partition_by=RetailerListing.wine_id, order_by=usd_price.asc())
            .label("rn"),
        )
        .where(RetailerListing.price.isnot(None))
        .subquery()
    )
    return select(ranked).where(ranked.c.rn == 1).subquery()


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


def _row_to_dict(
    wine: Wine, winery_name: str, price: Optional[float], currency: Optional[str], grapes: list[dict]
) -> dict:
    return {
        "id": wine.id,
        "name": wine.name,
        "winery": winery_name,
        "vintage": wine.vintage,
        "type": wine.type,
        "country": wine.country,
        "region": wine.region,
        "grapes": grapes,
        "price": price,
        "currency": currency,
        "price_usd_approx": approx_usd(price, currency),
        "image_url": wine.image_url,
        "sweetness": wine.sweetness,
        "acidity": wine.acidity,
        "tannin": wine.tannin,
        "body": wine.body,
        "fruitiness": wine.fruitiness,
    }


def _listing_to_dict(listing: RetailerListing, retailer_name: str) -> dict:
    return {
        "id": listing.id,
        "retailer": retailer_name,
        "price": listing.price,
        "currency": listing.currency,
        "price_usd_approx": approx_usd(listing.price, listing.currency),
        "product_url": listing.product_url,
        "availability": listing.availability,
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
    price_sq = _cheapest_listing_subquery()

    stmt = (
        select(Wine, Winery.name.label("winery_name"), price_sq.c.price, price_sq.c.currency)
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
        stmt = stmt.where(price_sq.c.usd_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(price_sq.c.usd_price <= max_price)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    if sort == "price_asc":
        stmt = stmt.order_by(price_sq.c.usd_price.asc().nulls_last(), Wine.id)
    elif sort == "price_desc":
        stmt = stmt.order_by(price_sq.c.usd_price.desc().nulls_last(), Wine.id)
    elif sort == "vintage":
        stmt = stmt.order_by(Wine.vintage.asc().nulls_last(), Wine.id)
    else:
        stmt = stmt.order_by(Winery.name.asc(), Wine.id)

    rows = db.execute(stmt.offset(offset).limit(limit)).all()
    wine_ids = [wine.id for wine, _, _, _ in rows]
    grapes_by_wine = _grapes_for_wines(db, wine_ids)
    items = [
        _row_to_dict(wine, winery_name, price, currency, grapes_by_wine.get(wine.id, []))
        for wine, winery_name, price, currency in rows
    ]
    return total, items


def get_wine(db: Session, wine_id: int) -> Optional[dict]:
    price_sq = _cheapest_listing_subquery()
    stmt = (
        select(Wine, Winery.name.label("winery_name"), price_sq.c.price, price_sq.c.currency)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
        .where(Wine.id == wine_id)
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        return None
    wine, winery_name, price, currency = row

    listing_stmt = (
        select(RetailerListing, Retailer.name.label("retailer_name"))
        .join(Retailer, RetailerListing.retailer_id == Retailer.id)
        .where(RetailerListing.wine_id == wine_id)
    )
    listing_rows = db.execute(listing_stmt).all()

    grapes = _grapes_for_wine(db, wine_id)
    data = _row_to_dict(wine, winery_name, price, currency, grapes)
    data["subregion"] = wine.subregion
    data["abv"] = wine.abv
    data["description"] = wine.description
    data["listings"] = [_listing_to_dict(listing, retailer_name) for listing, retailer_name in listing_rows]
    return data


def get_winery_by_name(db: Session, name: str) -> Optional[Winery]:
    return db.query(Winery).filter_by(name=name).one_or_none()


def update_wine(db: Session, wine_id: int, updates: dict) -> Optional[dict]:
    wine = db.get(Wine, wine_id)
    if wine is None:
        return None
    for field, value in updates.items():
        setattr(wine, field, value)
    db.commit()
    return get_wine(db, wine_id)


def get_or_create_retailer(db: Session, name: str) -> Retailer:
    retailer = db.query(Retailer).filter_by(name=name).one_or_none()
    if retailer is None:
        retailer = Retailer(name=name)
        db.add(retailer)
        db.flush()
    return retailer


def _get_listing_for_wine(db: Session, wine_id: int, listing_id: int) -> Optional[RetailerListing]:
    return db.query(RetailerListing).filter_by(id=listing_id, wine_id=wine_id).one_or_none()


def create_listing(db: Session, wine_id: int, data: dict) -> Optional[dict]:
    wine = db.get(Wine, wine_id)
    if wine is None:
        return None
    retailer = get_or_create_retailer(db, data["retailer"])
    now = datetime.now(timezone.utc)
    listing = RetailerListing(
        wine_id=wine_id,
        retailer_id=retailer.id,
        price=data.get("price"),
        currency=data.get("currency"),
        availability=data.get("availability"),
        product_url=data.get("product_url"),
        collected_at=now,
        last_verified_at=now,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return _listing_to_dict(listing, retailer.name)


def update_listing(db: Session, wine_id: int, listing_id: int, updates: dict) -> Optional[dict]:
    listing = _get_listing_for_wine(db, wine_id, listing_id)
    if listing is None:
        return None
    for field, value in updates.items():
        setattr(listing, field, value)
    listing.last_verified_at = datetime.now(timezone.utc)
    db.commit()
    retailer = db.get(Retailer, listing.retailer_id)
    return _listing_to_dict(listing, retailer.name)


def delete_listing(db: Session, wine_id: int, listing_id: int) -> bool:
    listing = _get_listing_for_wine(db, wine_id, listing_id)
    if listing is None:
        return False
    db.delete(listing)
    db.commit()
    return True


def get_or_create_grape(db: Session, name: str) -> Grape:
    grape = db.query(Grape).filter_by(name=name).one_or_none()
    if grape is None:
        grape = Grape(name=name)
        db.add(grape)
        db.flush()
    return grape


def update_grapes(db: Session, wine_id: int, grapes: list[dict]) -> Optional[dict]:
    wine = db.get(Wine, wine_id)
    if wine is None:
        return None
    wine.grapes.clear()
    for entry in grapes:
        grape = get_or_create_grape(db, entry["name"])
        wine.grapes.append(WineGrape(grape=grape, percentage=entry.get("percentage")))
    db.commit()
    return get_wine(db, wine_id)
