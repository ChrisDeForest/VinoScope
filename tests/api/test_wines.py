import pytest

from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery


@pytest.fixture
def seeded_wines(db_session):
    caymus = Winery(name="Caymus Vineyards", country="United States", region="Napa Valley")
    margaux = Winery(name="Château Margaux", country="France", region="Bordeaux")
    db_session.add_all([caymus, margaux])
    db_session.flush()

    cab = Grape(name="Cabernet Sauvignon")
    chard = Grape(name="Chardonnay")
    merlot = Grape(name="Merlot")
    db_session.add_all([cab, chard, merlot])
    db_session.flush()

    total_wine = Retailer(name="Total Wine")
    wine_com = Retailer(name="Wine.com")
    db_session.add_all([total_wine, wine_com])
    db_session.flush()

    wine1 = Wine(
        winery=caymus, name="Caymus Cabernet Sauvignon", vintage=2022, type="red", country="United States"
    )
    wine1.grapes.append(WineGrape(grape=cab, percentage=100))
    wine1.listings.append(RetailerListing(retailer=total_wine, price=79.99, currency="USD"))
    wine1.listings.append(RetailerListing(retailer=wine_com, price=84.99, currency="USD"))

    wine2 = Wine(winery=caymus, name="Caymus Chardonnay", vintage=2021, type="white", country="United States")
    wine2.grapes.append(WineGrape(grape=chard, percentage=None))

    wine3 = Wine(winery=margaux, name="Margaux Bordeaux Blend", vintage=2019, type="red", country="France")
    wine3.grapes.append(WineGrape(grape=cab, percentage=60))
    wine3.grapes.append(WineGrape(grape=merlot, percentage=40))
    wine3.listings.append(RetailerListing(retailer=wine_com, price=250.00, currency="USD"))

    db_session.add_all([wine1, wine2, wine3])
    db_session.commit()

    return {"wine1": wine1.id, "wine2": wine2.id, "wine3": wine3.id}


@pytest.fixture
def wine_with_all_null_percentage_grapes(db_session):
    winery = Winery(name="Unknown Blends Estate", country="United States", region="Sonoma")
    db_session.add(winery)
    db_session.flush()

    grape_z = Grape(name="Zinfandel")
    grape_a = Grape(name="Aglianico")
    grape_m = Grape(name="Malbec")
    db_session.add_all([grape_z, grape_a, grape_m])
    db_session.flush()

    wine = Wine(winery=winery, name="Mystery Field Blend", vintage=2020, type="red", country="United States")
    wine.grapes.append(WineGrape(grape=grape_z, percentage=None))
    wine.grapes.append(WineGrape(grape=grape_a, percentage=None))
    wine.grapes.append(WineGrape(grape=grape_m, percentage=None))
    db_session.add(wine)
    db_session.commit()

    return wine.id


@pytest.fixture
def mixed_currency_wines(db_session):
    winery = Winery(name="Global Cellars", country="France", region="Bordeaux")
    db_session.add(winery)
    db_session.flush()

    grape = Grape(name="Merlot")
    db_session.add(grape)
    db_session.flush()

    retailer = Retailer(name="Euro Wines")
    db_session.add(retailer)
    db_session.flush()

    # Raw price 50.00 EUR ~= $54.00 USD (rate 1.08) -- pricier in USD terms.
    wine_eur = Wine(winery=winery, name="Bordeaux Blend EUR", vintage=2020, type="red", country="France")
    wine_eur.grapes.append(WineGrape(grape=grape, percentage=100))
    wine_eur.listings.append(RetailerListing(retailer=retailer, price=50.00, currency="EUR"))

    # Raw price 52.00 USD -- cheaper in USD terms than the EUR wine above, despite the higher raw number.
    wine_usd = Wine(winery=winery, name="Bordeaux Blend USD", vintage=2020, type="red", country="France")
    wine_usd.grapes.append(WineGrape(grape=grape, percentage=100))
    wine_usd.listings.append(RetailerListing(retailer=retailer, price=52.00, currency="USD"))

    db_session.add_all([wine_eur, wine_usd])
    db_session.commit()

    return {"wine_eur": wine_eur.id, "wine_usd": wine_usd.id}


def test_list_wines_item_includes_currency_and_price_usd_approx(client, mixed_currency_wines):
    response = client.get("/api/wines", params={"q": "Bordeaux Blend EUR"})
    body = response.json()
    item = body["items"][0]
    assert item["price"] == 50.00
    assert item["currency"] == "EUR"
    assert item["price_usd_approx"] == 54.00


def test_list_wines_sort_price_asc_uses_usd_equivalent_not_raw_number(client, mixed_currency_wines):
    response = client.get("/api/wines", params={"sort": "price_asc"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [mixed_currency_wines["wine_usd"], mixed_currency_wines["wine_eur"]]


def test_list_wines_price_filter_uses_usd_equivalent_not_raw_number(client, mixed_currency_wines):
    response = client.get("/api/wines", params={"min_price": 53})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {mixed_currency_wines["wine_eur"]}


def test_get_wine_detail_listing_includes_price_usd_approx(client, mixed_currency_wines):
    response = client.get(f"/api/wines/{mixed_currency_wines['wine_eur']}")
    body = response.json()
    assert body["listings"][0]["price_usd_approx"] == 54.00


def test_list_wines_no_filters_returns_all_with_total(client, seeded_wines):
    response = client.get("/api/wines")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3


def test_list_wines_filters_by_type(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "white"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine2"]


def test_list_wines_filters_by_type_case_insensitive(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "WHITE"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine2"]


def test_list_wines_filters_by_country(client, seeded_wines):
    response = client.get("/api/wines", params={"country": "France"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_filters_by_country_case_insensitive(client, seeded_wines):
    response = client.get("/api/wines", params={"country": "fRaNcE"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_filters_by_grape_substring(client, seeded_wines):
    response = client.get("/api/wines", params={"grape": "cabernet"})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {seeded_wines["wine1"], seeded_wines["wine3"]}


def test_list_wines_filters_by_grape_escapes_percent_wildcard(client, seeded_wines):
    response = client.get("/api/wines", params={"grape": "%"})
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_wines_filters_by_price_range(client, seeded_wines):
    response = client.get("/api/wines", params={"min_price": 100, "max_price": 300})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_price_filter_excludes_wines_with_no_listings(client, seeded_wines):
    response = client.get("/api/wines", params={"min_price": 0})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert seeded_wines["wine2"] not in ids


def test_list_wines_price_is_minimum_across_listings(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "red", "country": "United States"})
    body = response.json()
    assert body["items"][0]["price"] == 79.99


def test_list_wines_wine_with_no_listings_has_null_price(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "white"})
    body = response.json()
    assert body["items"][0]["price"] is None


def test_list_wines_sort_price_asc_puts_nulls_last(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "price_asc"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine1"], seeded_wines["wine3"], seeded_wines["wine2"]]


def test_list_wines_sort_price_desc_puts_nulls_last(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "price_desc"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine3"], seeded_wines["wine1"], seeded_wines["wine2"]]


def test_list_wines_sort_vintage(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "vintage"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine3"], seeded_wines["wine2"], seeded_wines["wine1"]]


def test_list_wines_default_sort_is_winery_name(client, seeded_wines):
    response = client.get("/api/wines")
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine1"], seeded_wines["wine2"], seeded_wines["wine3"]]


def test_list_wines_blend_grapes_ordered_by_percentage_descending(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "red", "country": "France"})
    body = response.json()
    grapes = body["items"][0]["grapes"]
    assert grapes == [
        {"name": "Cabernet Sauvignon", "percentage": 60.0},
        {"name": "Merlot", "percentage": 40.0},
    ]


def test_list_wines_pagination_limit_and_offset(client, seeded_wines):
    response = client.get("/api/wines", params={"limit": 2, "offset": 0})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2

    response2 = client.get("/api/wines", params={"limit": 2, "offset": 2})
    body2 = response2.json()
    assert len(body2["items"]) == 1


def test_list_wines_invalid_sort_returns_422(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "bogus"})
    assert response.status_code == 422


def test_list_wines_limit_over_max_returns_422(client, seeded_wines):
    response = client.get("/api/wines", params={"limit": 101})
    assert response.status_code == 422


def test_list_wines_min_price_negative_returns_422(client, seeded_wines):
    response = client.get("/api/wines", params={"min_price": -1})
    assert response.status_code == 422


def test_list_wines_max_price_negative_returns_422(client, seeded_wines):
    response = client.get("/api/wines", params={"max_price": -1})
    assert response.status_code == 422


def test_list_wines_offset_negative_returns_422(client, seeded_wines):
    response = client.get("/api/wines", params={"offset": -1})
    assert response.status_code == 422


def test_get_wine_detail_returns_full_record(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine1']}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == seeded_wines["wine1"]
    assert body["name"] == "Caymus Cabernet Sauvignon"
    assert body["winery"] == "Caymus Vineyards"
    assert body["price"] == 79.99
    assert body["grapes"] == [{"name": "Cabernet Sauvignon", "percentage": 100.0}]


def test_get_wine_detail_includes_all_listings(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine1']}")
    body = response.json()
    retailers = {listing["retailer"] for listing in body["listings"]}
    assert retailers == {"Total Wine", "Wine.com"}
    prices = {listing["price"] for listing in body["listings"]}
    assert prices == {79.99, 84.99}


def test_get_wine_detail_blend_wine_includes_ordered_grapes(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine3']}")
    body = response.json()
    assert body["grapes"] == [
        {"name": "Cabernet Sauvignon", "percentage": 60.0},
        {"name": "Merlot", "percentage": 40.0},
    ]


def test_get_wine_detail_unknown_id_returns_404(client, seeded_wines):
    response = client.get("/api/wines/999999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Wine not found"


def test_get_wine_detail_no_listings_returns_empty_list_and_null_price(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine2']}")
    body = response.json()
    assert body["listings"] == []
    assert body["price"] is None


def test_get_wine_detail_all_null_percentage_grapes_ordered_alphabetically(
    client, wine_with_all_null_percentage_grapes
):
    response = client.get(f"/api/wines/{wine_with_all_null_percentage_grapes}")
    assert response.status_code == 200
    body = response.json()
    assert body["grapes"] == [
        {"name": "Aglianico", "percentage": None},
        {"name": "Malbec", "percentage": None},
        {"name": "Zinfandel", "percentage": None},
    ]


def test_list_wines_all_null_percentage_grapes_ordered_alphabetically(
    client, wine_with_all_null_percentage_grapes
):
    response = client.get("/api/wines")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["grapes"] == [
        {"name": "Aglianico", "percentage": None},
        {"name": "Malbec", "percentage": None},
        {"name": "Zinfandel", "percentage": None},
    ]


def test_list_wines_filters_by_search_matches_wine_name(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "chardonnay"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine2"]


def test_list_wines_filters_by_search_matches_winery_name(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "caymus"})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {seeded_wines["wine1"], seeded_wines["wine2"]}


def test_list_wines_search_is_case_insensitive(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "MARGAUX"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_search_escapes_percent_wildcard(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "%"})
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_wines_search_combines_with_other_filters(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "caymus", "type": "white"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine2"]


def test_cors_allows_configured_frontend_origin(client):
    response = client.get("/api/wines", headers={"Origin": "http://localhost:5173"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
