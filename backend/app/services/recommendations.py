from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Wine, Winery
from app.services.wines import _grapes_for_wines, _min_price_subquery, _row_to_dict

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
        return 0.0
    return (total_weighted_sq / total_weight) ** 0.5


def _match_score(distance: float) -> float:
    return 1.0 / (1.0 + distance)


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
            description.append(" or ".join(LABELS[dim][level] for level in sorted(set(val))))
    if type is not None:
        description.append(f"Primarily {type} wines")
    price_phrase = _price_phrase(min_price, max_price)
    if price_phrase is not None:
        description.append(price_phrase)
    return description


def build_explanation(
    user_values: dict[str, int | list[int] | None],
    wine: Wine,
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
        wine_val = getattr(wine, dim)
        if not user_val or wine_val is None:
            continue
        if min(abs(level - wine_val) for level in user_val) <= 1:
            explanation.append(LABELS[dim][wine_val])
    return explanation


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
    if min_price is not None:
        stmt = stmt.where(price_sq.c.min_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(price_sq.c.min_price <= max_price)

    rows = db.execute(stmt).all()

    scored = []
    for wine, winery_name, min_price_val in rows:
        distance = _distance(user_values, wine)
        score = _match_score(distance)
        scored.append((score, wine, winery_name, min_price_val))

    scored.sort(key=lambda entry: (-entry[0], entry[2], entry[1].id))

    total = len(scored)
    page = scored[offset : offset + limit]

    wine_ids = [wine.id for _, wine, _, _ in page]
    grapes_by_wine = _grapes_for_wines(db, wine_ids)

    items = []
    for score, wine, winery_name, min_price_val in page:
        data = _row_to_dict(wine, winery_name, min_price_val, grapes_by_wine.get(wine.id, []))
        data["match_score"] = score
        data["explanation"] = build_explanation(user_values, wine, type, country, min_price, max_price)
        items.append(data)

    profile = build_profile(user_values, type, min_price, max_price)
    return total, profile, items
