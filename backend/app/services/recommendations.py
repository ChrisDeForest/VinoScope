import threading
from typing import Optional

from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.models import RetailerListing, Wine, Winery
from app.services.currency import approx_usd
from app.services.wines import _cheapest_listing_subquery, _grapes_for_wines

DIMENSIONS = ("sweetness", "acidity", "tannin", "body", "fruitiness")

LABELS: dict[str, dict[int, str]] = {
    "sweetness": {1: "Very dry", 2: "Dry", 3: "Off-dry", 4: "Sweet", 5: "Very sweet"},
    "acidity": {
        1: "Low acidity",
        2: "Medium-low acidity",
        3: "Medium acidity",
        4: "Medium-high acidity",
        5: "High acidity",
    },
    "tannin": {
        1: "Low tannin",
        2: "Medium-low tannin",
        3: "Medium tannin",
        4: "Medium-high tannin",
        5: "High tannin",
    },
    "body": {
        1: "Very light-bodied",
        2: "Light-bodied",
        3: "Medium-bodied",
        4: "Full-bodied",
        5: "Very full-bodied",
    },
    "fruitiness": {
        1: "Subtle fruit",
        2: "Light fruit",
        3: "Moderate fruit",
        4: "Fruit-forward",
        5: "Very fruit-forward",
    },
}


def _levels(value: int | list[int] | None) -> list[int]:
    return [value] if isinstance(value, int) else (value or [])


def _distance(user_values: dict[str, int | list[int] | None], wine: Wine) -> float:
    total_weighted_sq = 0.0
    total_weight = 0.0
    for dim in DIMENSIONS:
        user_val = _levels(user_values.get(dim))
        wine_val = getattr(wine, dim)
        if not user_val or wine_val is None:
            continue
        total_weighted_sq += min((level - wine_val) ** 2 for level in user_val)
        total_weight += 1
    if total_weight == 0:
        # Two different situations both land here: the user asked for nothing at
        # all (every wine ties at a neutral score), or the user asked about some
        # dimensions but this particular wine has no data on any of them (it
        # can't be scored, so it must rank worse than every real comparison --
        # not tie with a perfect match).
        user_asked_anything = any(_levels(user_values.get(dim)) for dim in DIMENSIONS)
        return float("inf") if user_asked_anything else 0.0
    return (total_weighted_sq / total_weight) ** 0.5


def _match_score(distance: float) -> float:
    return 1.0 / (1.0 + distance)


def _factor_counts(user_values: dict[str, int | list[int] | None], wine: Wine) -> tuple[int, int]:
    requested = 0
    compared = 0
    for dim in DIMENSIONS:
        if not _levels(user_values.get(dim)):
            continue
        requested += 1
        if getattr(wine, dim) is not None:
            compared += 1
    return compared, requested


def _price_phrase(min_price: Optional[float], max_price: Optional[float]) -> Optional[str]:
    if min_price is not None and max_price is not None:
        return f"Preferred price range: ${min_price:g}–${max_price:g}"
    if max_price is not None:
        return f"Preferred price: under ${max_price:g}"
    if min_price is not None:
        return f"Preferred price: ${min_price:g} and up"
    return None


def _price_explanation(min_price: Optional[float], max_price: Optional[float]) -> Optional[str]:
    if min_price is not None and max_price is not None:
        return f"Within your ${min_price:g}–${max_price:g} price range"
    if max_price is not None:
        return f"Under your ${max_price:g} price limit"
    if min_price is not None:
        return f"Above your ${min_price:g} minimum"
    return None


def build_profile(
    user_values: dict[str, int | list[int] | None],
    type: Optional[str],
    min_price: Optional[float],
    max_price: Optional[float],
) -> list[str]:
    description: list[str] = []
    for dim in DIMENSIONS:
        val = _levels(user_values.get(dim))
        if val:
            levels = sorted(set(val))
            if len(levels) == 1:
                description.append(LABELS[dim][levels[0]])
            else:
                description.append(f"{LABELS[dim][levels[0]]} to {LABELS[dim][levels[-1]]}")
    if type is not None:
        description.append(f"Primarily {type} wines")
    price_phrase = _price_phrase(min_price, max_price)
    if price_phrase is not None:
        description.append(price_phrase)
    return description


def build_explanation(
    user_values: dict[str, int | list[int] | None],
    wine_dims: dict[str, Optional[int]],
    type: Optional[str],
    country: Optional[str],
    min_price: Optional[float],
    max_price: Optional[float],
) -> list[str]:
    explanation: list[str] = []
    price_phrase = _price_explanation(min_price, max_price)
    if price_phrase is not None:
        explanation.append(price_phrase)
    if type is not None:
        explanation.append(f"{type.capitalize()} wine as requested")
    if country is not None:
        explanation.append(f"From {country}")
    for dim in DIMENSIONS:
        user_val = _levels(user_values.get(dim))
        wine_val = wine_dims.get(dim)
        if not user_val or wine_val is None:
            continue
        if min(abs(level - wine_val) for level in user_val) <= 1:
            explanation.append(LABELS[dim][wine_val])
    return explanation


def _ranking_key(
    user_values: dict[str, int | list[int] | None],
    type: Optional[str],
    country: Optional[str],
    min_price: Optional[float],
    max_price: Optional[float],
) -> tuple:
    dims_key = tuple(tuple(sorted(_levels(user_values.get(dim)))) for dim in DIMENSIONS)
    return (dims_key, type, country, min_price, max_price)


# Ranking a full catalog (scoring + sorting every wine) is the expensive part of a
# recommendations request. Requests that only differ by limit/offset -- "Load more"
# clicks -- ask for the exact same ranking, so it is cached here keyed on the filter
# inputs.
#
# Staleness is tracked with an in-memory counter rather than a per-request DB query:
# any commit that touches a Wine, RetailerListing or Winery row bumps `_catalog_version`
# (via the SQLAlchemy `before_flush` hook below), so checking it costs nothing beyond
# reading an int -- no full-table scan on every request just to see whether the cache
# is still good, including "Load more" hits that should be nearly free.
_CATALOG_MAPPED_CLASSES = (Wine, RetailerListing, Winery)
_catalog_version_lock = threading.Lock()
_catalog_version = 0


def _bump_catalog_version(session, flush_context, instances) -> None:
    global _catalog_version
    changed = session.new | session.dirty | session.deleted
    if any(isinstance(obj, _CATALOG_MAPPED_CLASSES) for obj in changed):
        with _catalog_version_lock:
            _catalog_version += 1


event.listen(Session, "before_flush", _bump_catalog_version)

_RANKING_CACHE_MAX_ENTRIES = 200
_ranking_cache: dict[tuple, list[dict]] = {}
_ranking_cache_version: Optional[int] = None
_ranking_cache_lock = threading.Lock()


def _ranked_wines(
    db: Session,
    user_values: dict[str, int | list[int] | None],
    type: Optional[str],
    country: Optional[str],
    min_price: Optional[float],
    max_price: Optional[float],
) -> list[dict]:
    global _ranking_cache_version

    key = _ranking_key(user_values, type, country, min_price, max_price)

    version_before = _catalog_version
    with _ranking_cache_lock:
        if _ranking_cache_version == version_before:
            cached = _ranking_cache.get(key)
            if cached is not None:
                return cached

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
    if min_price is not None:
        stmt = stmt.where(price_sq.c.usd_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(price_sq.c.usd_price <= max_price)

    rows = db.execute(stmt).all()

    scored = []
    for wine, winery_name, price, currency in rows:
        distance = _distance(user_values, wine)
        compared, requested = _factor_counts(user_values, wine)
        scored.append(
            {
                "score": _match_score(distance),
                "wine_id": wine.id,
                "winery_name": winery_name,
                "price": price,
                "currency": currency,
                "name": wine.name,
                "vintage": wine.vintage,
                "type": wine.type,
                "country": wine.country,
                "region": wine.region,
                "image_url": wine.image_url,
                "sweetness": wine.sweetness,
                "acidity": wine.acidity,
                "tannin": wine.tannin,
                "body": wine.body,
                "fruitiness": wine.fruitiness,
                "factors_compared": compared,
                "factors_requested": requested,
            }
        )

    scored.sort(key=lambda entry: (-entry["score"], entry["winery_name"], entry["wine_id"]))

    version_after = _catalog_version
    with _ranking_cache_lock:
        # Only cache the result if no commit touched the catalog while it was being
        # computed -- otherwise it may already be stale, and caching it would hide
        # that staleness behind a false cache "hit" on the next request.
        if version_after == version_before:
            if _ranking_cache_version != version_before:
                _ranking_cache.clear()
                _ranking_cache_version = version_before
            _ranking_cache[key] = scored
            if len(_ranking_cache) > _RANKING_CACHE_MAX_ENTRIES:
                _ranking_cache.pop(next(iter(_ranking_cache)))
    return scored


def get_recommendations(
    db: Session,
    *,
    sweetness: int | list[int] | None = None,
    acidity: int | list[int] | None = None,
    tannin: int | list[int] | None = None,
    body: int | list[int] | None = None,
    fruitiness: int | list[int] | None = None,
    type: Optional[str] = None,
    country: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[str], list[dict]]:
    user_values = {
        "sweetness": sweetness,
        "acidity": acidity,
        "tannin": tannin,
        "body": body,
        "fruitiness": fruitiness,
    }

    ranked = _ranked_wines(db, user_values, type, country, min_price, max_price)
    total = len(ranked)
    page = ranked[offset : offset + limit]

    wine_ids = [entry["wine_id"] for entry in page]
    grapes_by_wine = _grapes_for_wines(db, wine_ids)

    items = []
    for entry in page:
        wine_dims = {dim: entry[dim] for dim in DIMENSIONS}
        items.append(
            {
                "id": entry["wine_id"],
                "name": entry["name"],
                "winery": entry["winery_name"],
                "vintage": entry["vintage"],
                "type": entry["type"],
                "country": entry["country"],
                "region": entry["region"],
                "grapes": grapes_by_wine.get(entry["wine_id"], []),
                "price": entry["price"],
                "currency": entry["currency"],
                "price_usd_approx": approx_usd(entry["price"], entry["currency"]),
                "image_url": entry["image_url"],
                **wine_dims,
                "match_score": entry["score"],
                "factors_compared": entry["factors_compared"],
                "factors_requested": entry["factors_requested"],
                "explanation": build_explanation(user_values, wine_dims, type, country, min_price, max_price),
            }
        )

    profile = build_profile(user_values, type, min_price, max_price)
    return total, profile, items
