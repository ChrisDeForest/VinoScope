from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Retailer, RetailerListing, Wine, Winery
from app.services.currency import CURRENCY_RATES


def _rate_case():
    return case(
        {code: rate for code, rate in CURRENCY_RATES.items()},
        value=func.upper(RetailerListing.currency),
        else_=1.0,
    )


def _numeric_stats(db: Session, total_rows: int, column) -> dict:
    count, min_v, max_v, avg_v = db.execute(
        select(func.count(column), func.min(column), func.max(column), func.avg(column))
    ).one()
    return {
        "count": count,
        "null_count": total_rows - count,
        "min": float(min_v) if min_v is not None else None,
        "max": float(max_v) if max_v is not None else None,
        "avg": round(float(avg_v), 2) if avg_v is not None else None,
    }


def _categorical_counts(db: Session, column) -> dict:
    rows = db.execute(
        select(column, func.count()).where(column.isnot(None)).group_by(column).order_by(func.count().desc())
    ).all()
    return {value: count for value, count in rows}


def get_stats(db: Session) -> dict:
    wines_count = db.scalar(select(func.count()).select_from(Wine))
    wineries_count = db.scalar(select(func.count()).select_from(Winery))
    retailers_count = db.scalar(select(func.count()).select_from(Retailer))
    listings_count = db.scalar(select(func.count()).select_from(RetailerListing))

    usd_price = RetailerListing.price * _rate_case()

    numeric = {
        "vintage": _numeric_stats(db, wines_count, Wine.vintage),
        "abv": _numeric_stats(db, wines_count, Wine.abv),
        "sweetness": _numeric_stats(db, wines_count, Wine.sweetness),
        "acidity": _numeric_stats(db, wines_count, Wine.acidity),
        "tannin": _numeric_stats(db, wines_count, Wine.tannin),
        "body": _numeric_stats(db, wines_count, Wine.body),
        "fruitiness": _numeric_stats(db, wines_count, Wine.fruitiness),
        "price": _numeric_stats(db, listings_count, RetailerListing.price),
        "price_usd_approx": _numeric_stats(db, listings_count, usd_price),
    }

    categorical = {
        "type": _categorical_counts(db, Wine.type),
        "country": _categorical_counts(db, Wine.country),
        "region": _categorical_counts(db, Wine.region),
        "currency": _categorical_counts(db, RetailerListing.currency),
        "availability": _categorical_counts(db, RetailerListing.availability),
    }

    return {
        "wines_count": wines_count,
        "wineries_count": wineries_count,
        "retailers_count": retailers_count,
        "listings_count": listings_count,
        "numeric": numeric,
        "categorical": categorical,
    }
