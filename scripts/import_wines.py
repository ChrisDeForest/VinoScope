import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from dotenv import load_dotenv

load_dotenv()

import pandas as pd
from sqlalchemy.orm import Session

from app.database.base import get_engine, get_session_factory
from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery
from app.schemas.wine import VALID_TYPES

INT_FIELDS = ("vintage",)
RATING_FIELDS = ("sweetness", "acidity", "tannin", "body", "fruitiness")
FLOAT_FIELDS = ("abv", "price")


class ImportValidationError(Exception):
    def __init__(self, row_errors):
        self.row_errors = row_errors
        message = "; ".join(f"row {i}: {err}" for i, err in row_errors)
        super().__init__(message)


def _clean(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text if text else None


def _try_parse_numeric(value, parser):
    """Attempt to parse a cleaned (non-blank) value with parser; return (parsed, ok)."""
    try:
        return parser(value), True
    except (TypeError, ValueError):
        return None, False


def validate_row(row):
    errors = []
    if not _clean(row.get("name")):
        errors.append("missing name")
    wine_type = _clean(row.get("type"))
    if not wine_type:
        errors.append("missing type")
    elif wine_type.lower() not in VALID_TYPES:
        errors.append(f"invalid type {wine_type!r}")
    if not _clean(row.get("winery")):
        errors.append("missing winery")
    if not _clean(row.get("source_site")):
        errors.append("missing source_site")
    if not _clean(row.get("source_url")):
        errors.append("missing source_url")

    for field_name in INT_FIELDS:
        value = _clean(row.get(field_name))
        if value is not None:
            if field_name == "vintage" and value.upper() == "NV":
                continue
            _, ok = _try_parse_numeric(value, int)
            if not ok:
                errors.append(f"invalid {field_name} {value!r}")

    for field_name in FLOAT_FIELDS:
        value = _clean(row.get(field_name))
        if value is not None:
            _, ok = _try_parse_numeric(value, float)
            if not ok:
                errors.append(f"invalid {field_name} {value!r}")

    for field_name in RATING_FIELDS:
        value = _clean(row.get(field_name))
        if value is not None:
            parsed, ok = _try_parse_numeric(value, int)
            if not ok:
                errors.append(f"invalid {field_name} {value!r}")
            elif not (1 <= parsed <= 5):
                errors.append(f"{field_name} must be between 1 and 5, got {value!r}")

    return errors


def get_or_create_winery(session: Session, name, country=None, region=None) -> Winery:
    winery = session.query(Winery).filter_by(name=name).one_or_none()
    if winery is None:
        winery = Winery(name=name, country=country, region=region)
        session.add(winery)
        session.flush()
    return winery


def get_or_create_grape(session: Session, name) -> Grape:
    grape = session.query(Grape).filter_by(name=name).one_or_none()
    if grape is None:
        grape = Grape(name=name)
        session.add(grape)
        session.flush()
    return grape


def get_or_create_retailer(session: Session, name) -> Retailer:
    retailer = session.query(Retailer).filter_by(name=name).one_or_none()
    if retailer is None:
        retailer = Retailer(name=name)
        session.add(retailer)
        session.flush()
    return retailer


def parse_grape_blend(grape_field, grape_pct_field):
    grape_names = _clean(grape_field)
    names = [n.strip() for n in grape_names.split(";")] if grape_names else []
    pcts_raw = _clean(grape_pct_field) or ""
    pcts = pcts_raw.split(";") if pcts_raw else []
    blend = []
    for i, name in enumerate(names):
        pct = float(pcts[i]) if i < len(pcts) and pcts[i].strip() else None
        blend.append((name, pct))
    return blend


def upsert_wine(session: Session, row) -> Wine:
    winery = get_or_create_winery(
        session, _clean(row.get("winery")), _clean(row.get("country")), _clean(row.get("region"))
    )
    vintage_raw = _clean(row.get("vintage"))
    vintage = None if vintage_raw is None or vintage_raw.upper() == "NV" else int(vintage_raw)
    name = _clean(row["name"])
    wine_type = _clean(row["type"]).lower()

    wine = session.query(Wine).filter_by(winery_id=winery.id, name=name, vintage=vintage).one_or_none()
    if wine is None:
        wine = Wine(winery=winery, name=name, vintage=vintage, type=wine_type)
        session.add(wine)
    else:
        wine.type = wine_type

    wine.country = _clean(row.get("country"))
    wine.region = _clean(row.get("region"))
    wine.subregion = _clean(row.get("subregion"))
    wine.abv = float(row["abv"]) if _clean(row.get("abv")) else None
    wine.sweetness = int(row["sweetness"]) if _clean(row.get("sweetness")) else None
    wine.acidity = int(row["acidity"]) if _clean(row.get("acidity")) else None
    wine.tannin = int(row["tannin"]) if _clean(row.get("tannin")) else None
    wine.body = int(row["body"]) if _clean(row.get("body")) else None
    wine.fruitiness = int(row["fruitiness"]) if _clean(row.get("fruitiness")) else None
    wine.description = _clean(row.get("description"))
    wine.image_url = _clean(row.get("image_url"))
    session.flush()

    wine.grapes.clear()
    for grape_name, pct in parse_grape_blend(row.get("grape"), row.get("grape_pct")):
        grape = get_or_create_grape(session, grape_name)
        wine.grapes.append(WineGrape(grape=grape, percentage=pct))

    return wine


def create_retailer_listing(session: Session, wine: Wine, row) -> RetailerListing:
    retailer = get_or_create_retailer(session, _clean(row["source_site"]))
    listing = RetailerListing(
        wine=wine,
        retailer=retailer,
        price=float(row["price"]) if _clean(row.get("price")) else None,
        currency=_clean(row.get("currency")),
        product_url=_clean(row.get("source_url")),
        source_product_id=_clean(row.get("source_product_id")),
        collected_at=datetime.now(timezone.utc),
    )
    session.add(listing)
    return listing


def import_csv(csv_path, database_url=None):
    df = pd.read_csv(csv_path, dtype=str)

    row_errors = [(index, "; ".join(errors)) for index, row in df.iterrows() if (errors := validate_row(row))]
    if row_errors:
        raise ImportValidationError(row_errors)

    engine = get_engine(database_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        for _, row in df.iterrows():
            wine = upsert_wine(session, row)
            create_retailer_listing(session, wine, row)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()

    return len(df)


if __name__ == "__main__":
    imported = import_csv(sys.argv[1])
    print(f"Imported {imported} wine(s).")
