import pytest

from app.models import Retailer, RetailerListing, Wine, Winery


def test_multiple_preferences_rank_each_selected_level_as_a_match(client, recommendation_wines):
    response = client.post("/api/recommendations", json={"body": [2, 5], "sweetness": [1]})
    assert response.status_code == 200
    result = response.json()
    scores = {item["name"]: item["match_score"] for item in result["items"]}
    assert scores["Alpha Bold Red"] == 1
    assert scores["Alpha Light Red"] == 1
    assert scores["Beta White"] < 1
    assert "Light-bodied or Very full-bodied" in result["profile"]["description"]


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


def test_recommendations_price_filter_uses_usd_equivalent_not_raw_number(client, db_session, recommendation_wines):
    winery = Winery(name="ZAR Cellars", country="South Africa", region="Stellenbosch")
    db_session.add(winery)
    db_session.flush()

    retailer = Retailer(name="ZAR Retailer")
    db_session.add(retailer)
    db_session.flush()

    zar_wine = Wine(
        winery=winery,
        name="Stellenbosch Red",
        vintage=2020,
        type="red",
        country="South Africa",
    )
    # Raw price 900 ZAR * 0.055 rate ~= $49.50 USD -- should pass max_price=60
    # even though the raw number 900 is far above 60.
    zar_wine.listings.append(RetailerListing(retailer=retailer, price=900.0, currency="ZAR"))
    db_session.add(zar_wine)
    db_session.commit()

    response = client.post("/api/recommendations", json={"max_price": 60})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert zar_wine.id in ids


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
    response = client.post("/api/recommendations", json={"type": "red", "sweetness": 1, "acidity": 1})
    body = response.json()
    items_by_id = {item["id"]: item for item in body["items"]}
    partial = items_by_id[recommendation_wines["partial_red"]]
    bold = items_by_id[recommendation_wines["bold_red"]]
    # partial_red: acidity=None (excluded), sweetness=1 matches user's sweetness=1 exactly -> distance 0 -> score 1.0
    assert partial["match_score"] == 1.0
    # bold_red: both dims present. sweetness diff=0, acidity diff=|1-3|=2 -> distance = sqrt((0+4)/2) = sqrt(2) ≈ 1.4142
    assert bold["match_score"] == pytest.approx(1 / (1 + (2 ** 0.5)))


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
    full_response = client.post("/api/recommendations", json={"type": "red"})
    all_ids = [item["id"] for item in full_response.json()["items"]]
    assert len(all_ids) == 4

    response = client.post("/api/recommendations", json={"type": "red", "limit": 2, "offset": 0})
    body = response.json()
    assert body["total"] == 4
    page1_ids = [item["id"] for item in body["items"]]
    assert len(page1_ids) == 2

    response2 = client.post("/api/recommendations", json={"type": "red", "limit": 2, "offset": 2})
    body2 = response2.json()
    page2_ids = [item["id"] for item in body2["items"]]
    assert len(page2_ids) == 2

    assert page1_ids + page2_ids == all_ids


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


def test_recommendations_cors_allows_post_preflight(client):
    response = client.options(
        "/api/recommendations",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert "POST" in response.headers.get("access-control-allow-methods", "")
