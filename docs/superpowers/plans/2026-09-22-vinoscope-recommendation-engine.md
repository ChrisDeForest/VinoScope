# VinoScope Recommendation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stateless `POST /api/recommendations` endpoint that ranks wines by weighted-Euclidean-distance similarity to user-supplied preferences, with hard filters, a profile summary, and per-wine explanations.

**Architecture:** Same layered pattern as the existing Wines API: a thin route in `app/api/recommendations.py`, all scoring/filtering/text-generation logic in `app/services/recommendations.py`, response shapes in `app/schemas/recommendation.py`. Reuses `_min_price_subquery`, `_grapes_for_wines`, and `_row_to_dict` from `app/services/wines.py` rather than duplicating them.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2.0, PostgreSQL — no new dependencies.

## Global Constraints

- Synchronous SQLAlchemy only, matching the rest of the backend.
- Stateless: no new database tables, no persistence of questionnaire answers or profiles.
- Hard filters (`type`, `country`, `min_price`, `max_price`) use identical semantics to the existing `list_wines` filters — case-insensitive exact match for `type`/`country`, `MIN(retailer_listings.price)` comparison for price, reusing `_min_price_subquery`.
- Soft preferences (`sweetness`, `acidity`, `tannin`, `body`, `fruitiness`) use weighted Euclidean distance with equal weights, computed only over dimensions where both the user and the wine have a non-null value. A dimension missing on either side is excluded from that wine's distance calculation — never penalized, never defaulted to a midpoint.
- A wine with zero overlapping dimensions with the user's answers gets `distance = 0` (neutral/perfect score) rather than being excluded or penalized. This also covers a fully-empty request.
- `match_score = 1 / (1 + distance)`, a float in `(0, 1]`.
- Sort: `match_score` descending, then `Winery.name` ascending, then `Wine.id` ascending (tiebreak, matches `list_wines`'s default sort convention).
- Invalid request fields (dimension values outside 1–5, `limit`/`offset` out of range) return FastAPI's automatic `422` via Pydantic `Field` constraints — no manual validation code.
- All tests run against real Postgres (`vinoscope_test`) via FastAPI `TestClient` with the existing `get_db` dependency override — never mocks.
- Out of scope: any style-tier grouping stage, food-pairing preference, categorical fruit-type question, server-side profile persistence, the Discover page frontend.

---

### Task 1: `POST /api/recommendations` — hard filters, weighted scoring, profile, explanations

**Files:**
- Create: `backend/app/schemas/recommendation.py`
- Create: `backend/app/services/recommendations.py`
- Create: `backend/app/api/recommendations.py`
- Modify: `backend/app/main.py`
- Test: `tests/api/test_recommendations.py`

**Interfaces:**
- Consumes: `app.services.wines._min_price_subquery`, `app.services.wines._grapes_for_wines`, `app.services.wines._row_to_dict`, `app.schemas.wine.WineListItem` (all from the wines-api phase).
- Produces: `app.services.recommendations.get_recommendations(db, *, sweetness=None, acidity=None, tannin=None, body=None, fruitiness=None, type=None, country=None, min_price=None, max_price=None, limit=20, offset=0) -> tuple[int, list[str], list[dict]]` (total, profile description lines, item dicts each including `match_score` and `explanation`). Schemas `RecommendationRequest`, `ProfileOut`, `RecommendationItem`, `RecommendationResponse` in `app.schemas.recommendation`.

- [ ] **Step 1: Write the failing tests**

`tests/api/test_recommendations.py`:
```python
import pytest

from app.models import Retailer, RetailerListing, Wine, Winery


@pytest.fixture
def recommendation_wines(db_session):
    alpha = Winery(name="Alpha Cellars", country="United States", region="Napa Valley")
    beta = Winery(name="Beta Winery", country="France", region="Bordeaux")
    db_session.add_all([alpha, beta])
    db_session.flush()

    retailer = Retailer(name="Test Retailer")
    db_session.add(retailer)
    db_session.flush()

    bold_red = Wine(
        winery=alpha,
        name="Alpha Bold Red",
        vintage=2020,
        type="red",
        country="United States",
        sweetness=1,
        acidity=3,
        tannin=5,
        body=5,
        fruitiness=3,
    )
    bold_red.listings.append(RetailerListing(retailer=retailer, price=30.0, currency="USD"))

    light_red = Wine(
        winery=alpha,
        name="Alpha Light Red",
        vintage=2021,
        type="red",
        country="United States",
        sweetness=1,
        acidity=3,
        tannin=2,
        body=2,
        fruitiness=3,
    )
    light_red.listings.append(RetailerListing(retailer=retailer, price=25.0, currency="USD"))

    partial_red = Wine(
        winery=alpha,
        name="Alpha Partial Red",
        vintage=2019,
        type="red",
        country="United States",
        sweetness=1,
        acidity=None,
        tannin=5,
        body=5,
        fruitiness=3,
    )
    partial_red.listings.append(RetailerListing(retailer=retailer, price=35.0, currency="USD"))

    no_data_red = Wine(
        winery=beta,
        name="Beta No Data Red",
        vintage=2018,
        type="red",
        country="United States",
        sweetness=None,
        acidity=None,
        tannin=None,
        body=None,
        fruitiness=None,
    )
    no_data_red.listings.append(RetailerListing(retailer=retailer, price=15.0, currency="USD"))

    white_wine = Wine(
        winery=beta,
        name="Beta White",
        vintage=2022,
        type="white",
        country="France",
        sweetness=3,
        acidity=4,
        tannin=1,
        body=2,
        fruitiness=4,
    )
    white_wine.listings.append(RetailerListing(retailer=retailer, price=20.0, currency="USD"))

    db_session.add_all([bold_red, light_red, partial_red, no_data_red, white_wine])
    db_session.commit()

    return {
        "bold_red": bold_red.id,
        "light_red": light_red.id,
        "partial_red": partial_red.id,
        "no_data_red": no_data_red.id,
        "white_wine": white_wine.id,
    }


def test_recommendations_hard_filter_type_excludes_other_types(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"type": "red"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    ids = {item["id"] for item in body["items"]}
    assert recommendation_wines["white_wine"] not in ids


def test_recommendations_hard_filter_country(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"country": "France"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == recommendation_wines["white_wine"]


def test_recommendations_hard_filter_price_range(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"min_price": 20, "max_price": 30})
    body = response.json()
    assert body["total"] == 3
    ids = {item["id"] for item in body["items"]}
    assert ids == {
        recommendation_wines["bold_red"],
        recommendation_wines["light_red"],
        recommendation_wines["white_wine"],
    }


def test_recommendations_ranks_closer_match_first(client, recommendation_wines):
    response = client.post(
        "/api/recommendations", json={"type": "red", "sweetness": 1, "tannin": 5, "body": 5}
    )
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    bold_index = ids.index(recommendation_wines["bold_red"])
    light_index = ids.index(recommendation_wines["light_red"])
    assert bold_index < light_index


def test_recommendations_user_unsure_dimension_excluded_from_scoring_and_profile(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"type": "red", "tannin": 5, "body": 5})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids.index(recommendation_wines["bold_red"]) < ids.index(recommendation_wines["light_red"])
    assert body["profile"]["description"] == ["High tannin", "Very full-bodied", "Primarily red wines"]


def test_recommendations_wine_side_missing_dimension_excluded_for_that_wine_only(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"type": "red", "acidity": 4})
    body = response.json()
    items_by_id = {item["id"]: item for item in body["items"]}
    partial = items_by_id[recommendation_wines["partial_red"]]
    bold = items_by_id[recommendation_wines["bold_red"]]
    assert partial["match_score"] == 1.0
    assert bold["match_score"] < 1.0


def test_recommendations_wine_with_zero_overlap_gets_neutral_score(client, recommendation_wines):
    response = client.post(
        "/api/recommendations",
        json={"type": "red", "sweetness": 1, "acidity": 3, "tannin": 5, "body": 5, "fruitiness": 3},
    )
    body = response.json()
    items_by_id = {item["id"]: item for item in body["items"]}
    assert recommendation_wines["no_data_red"] in items_by_id
    assert items_by_id[recommendation_wines["no_data_red"]]["match_score"] == 1.0
    assert items_by_id[recommendation_wines["bold_red"]]["match_score"] == 1.0


def test_recommendations_empty_request_returns_all_wines_equal_score_sorted_by_winery(client, recommendation_wines):
    response = client.post("/api/recommendations", json={})
    body = response.json()
    assert body["total"] == 5
    assert all(item["match_score"] == 1.0 for item in body["items"])
    ids = [item["id"] for item in body["items"]]
    assert ids == [
        recommendation_wines["bold_red"],
        recommendation_wines["light_red"],
        recommendation_wines["partial_red"],
        recommendation_wines["no_data_red"],
        recommendation_wines["white_wine"],
    ]


def test_recommendations_pagination(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"type": "red", "limit": 2, "offset": 0})
    body = response.json()
    assert body["total"] == 4
    assert len(body["items"]) == 2

    response2 = client.post("/api/recommendations", json={"type": "red", "limit": 2, "offset": 2})
    body2 = response2.json()
    assert len(body2["items"]) == 2


def test_recommendations_explanation_includes_hard_filters_and_close_matches(client, recommendation_wines):
    response = client.post(
        "/api/recommendations", json={"type": "red", "max_price": 32, "tannin": 5}
    )
    body = response.json()
    items_by_id = {item["id"]: item for item in body["items"]}
    explanation = items_by_id[recommendation_wines["bold_red"]]["explanation"]
    assert "Under your $32 price limit" in explanation
    assert "Red wine as requested" in explanation
    assert "High tannin" in explanation


def test_recommendations_profile_description_reflects_answers(client, recommendation_wines):
    response = client.post(
        "/api/recommendations",
        json={"sweetness": 1, "tannin": 5, "type": "red", "min_price": 10, "max_price": 40},
    )
    body = response.json()
    assert body["profile"]["description"] == [
        "Very dry",
        "High tannin",
        "Primarily red wines",
        "Preferred price range: $10–$40",
    ]


def test_recommendations_invalid_sweetness_returns_422(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"sweetness": 6})
    assert response.status_code == 422


def test_recommendations_invalid_limit_returns_422(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"limit": 101})
    assert response.status_code == 422


def test_recommendations_invalid_offset_returns_422(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"offset": -1})
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_recommendations.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.recommendation'` (or similar — the route doesn't exist yet, so every test fails at collection or on the first request).

- [ ] **Step 3: Implement the schemas**

`backend/app/schemas/recommendation.py`:
```python
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.wine import WineListItem


class RecommendationRequest(BaseModel):
    sweetness: Optional[int] = Field(default=None, ge=1, le=5)
    acidity: Optional[int] = Field(default=None, ge=1, le=5)
    tannin: Optional[int] = Field(default=None, ge=1, le=5)
    body: Optional[int] = Field(default=None, ge=1, le=5)
    fruitiness: Optional[int] = Field(default=None, ge=1, le=5)
    type: Optional[str] = None
    country: Optional[str] = None
    min_price: Optional[float] = Field(default=None, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ProfileOut(BaseModel):
    description: list[str]


class RecommendationItem(WineListItem):
    match_score: float
    explanation: list[str]


class RecommendationResponse(BaseModel):
    profile: ProfileOut
    total: int
    items: list[RecommendationItem]
```

- [ ] **Step 4: Implement the service layer**

`backend/app/services/recommendations.py`:
```python
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


def _distance(user_values: dict[str, Optional[int]], wine: Wine) -> float:
    total_weighted_sq = 0.0
    total_weight = 0.0
    for dim in DIMENSIONS:
        user_val = user_values.get(dim)
        wine_val = getattr(wine, dim)
        if user_val is None or wine_val is None:
            continue
        total_weighted_sq += (user_val - wine_val) ** 2
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
    user_values: dict[str, Optional[int]],
    type: Optional[str],
    min_price: Optional[float],
    max_price: Optional[float],
) -> list[str]:
    description: list[str] = []
    for dim in DIMENSIONS:
        val = user_values.get(dim)
        if val is not None:
            description.append(LABELS[dim][val])
    if type is not None:
        description.append(f"Primarily {type} wines")
    price_phrase = _price_phrase(min_price, max_price)
    if price_phrase is not None:
        description.append(price_phrase)
    return description


def build_explanation(
    user_values: dict[str, Optional[int]],
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
        user_val = user_values.get(dim)
        wine_val = getattr(wine, dim)
        if user_val is None or wine_val is None:
            continue
        if abs(user_val - wine_val) <= 1:
            explanation.append(LABELS[dim][wine_val])
    return explanation


def get_recommendations(
    db: Session,
    *,
    sweetness: Optional[int] = None,
    acidity: Optional[int] = None,
    tannin: Optional[int] = None,
    body: Optional[int] = None,
    fruitiness: Optional[int] = None,
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
```

- [ ] **Step 5: Implement the route and register it**

`backend/app/api/recommendations.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.recommendation import ProfileOut, RecommendationRequest, RecommendationResponse
from app.services import recommendations as recommendations_service

router = APIRouter()


@router.post("/recommendations", response_model=RecommendationResponse)
def get_recommendations(
    request: RecommendationRequest,
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    total, profile, items = recommendations_service.get_recommendations(
        db,
        sweetness=request.sweetness,
        acidity=request.acidity,
        tannin=request.tannin,
        body=request.body,
        fruitiness=request.fruitiness,
        type=request.type,
        country=request.country,
        min_price=request.min_price,
        max_price=request.max_price,
        limit=request.limit,
        offset=request.offset,
    )
    return RecommendationResponse(profile=ProfileOut(description=profile), total=total, items=items)
```

In `backend/app/main.py`, add the import (after the existing `wines_router` import):
```python
from app.api.recommendations import router as recommendations_router
```

Add `"POST"` to the CORS `allow_methods` list — the existing config only allows `GET`, which would silently block this new endpoint from the frontend:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

Register the new router (after the existing `app.include_router(wines_router, prefix="/api")` line):
```python
app.include_router(recommendations_router, prefix="/api")
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/api/test_recommendations.py -v`
Expected: PASS (14 tests)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS (80 tests total — 14 new plus the existing 66)

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/recommendation.py backend/app/services/recommendations.py \
  backend/app/api/recommendations.py backend/app/main.py tests/api/test_recommendations.py
git commit -m "feat: add recommendation engine with weighted-distance scoring"
```
