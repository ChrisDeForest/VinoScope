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
def admin_headers(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-admin-key")
    return {"X-Admin-Key": "test-admin-key"}


def test_update_wine_changes_single_field_leaves_others(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"abv": 14.9}, headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["abv"] == 14.9
    assert body["name"] == "Caymus Cabernet Sauvignon"


def test_update_wine_null_clears_nullable_field(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"vintage": None}, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["vintage"] is None


def test_update_wine_unknown_id_returns_404(client, admin_headers):
    response = client.patch("/api/wines/999999", json={"abv": 14.0}, headers=admin_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Wine not found"


def test_update_wine_invalid_type_returns_422(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"type": "bogus"}, headers=admin_headers)
    assert response.status_code == 422


def test_update_wine_type_normalized_to_lowercase(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"type": "WHITE"}, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["type"] == "white"


def test_update_wine_rating_out_of_range_returns_422(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"sweetness": 6}, headers=admin_headers)
    assert response.status_code == 422


def test_update_wine_abv_out_of_range_returns_422(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"abv": 101}, headers=admin_headers)
    assert response.status_code == 422


def test_update_wine_reassigns_winery_by_name(client, admin_headers, seeded_wines):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}", json={"winery": "Château Margaux"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["winery"] == "Château Margaux"


def test_update_wine_unknown_winery_name_returns_404_and_does_not_create_one(
    client, admin_headers, seeded_wines, db_session
):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}", json={"winery": "Nonexistent Winery"}, headers=admin_headers
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Winery not found"
    assert db_session.query(Winery).filter_by(name="Nonexistent Winery").one_or_none() is None


def test_update_wine_missing_admin_key_returns_401(client, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"abv": 14.0})
    assert response.status_code == 401


def test_update_wine_wrong_admin_key_returns_401(client, admin_headers, seeded_wines):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}", json={"abv": 14.0}, headers={"X-Admin-Key": "wrong-key"}
    )
    assert response.status_code == 401


def test_get_wine_detail_listing_includes_id(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine1']}")
    body = response.json()
    assert all("id" in listing for listing in body["listings"])


def test_create_listing_adds_new_retailer(client, admin_headers, seeded_wines):
    response = client.post(
        f"/api/wines/{seeded_wines['wine2']}/listings",
        json={"retailer": "Brand New Shop", "price": 25.00, "currency": "usd"},
        headers=admin_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["retailer"] == "Brand New Shop"
    assert body["price"] == 25.00
    assert body["currency"] == "USD"
    assert "id" in body


def test_create_listing_reuses_existing_retailer(client, admin_headers, seeded_wines, db_session):
    client.post(
        f"/api/wines/{seeded_wines['wine2']}/listings",
        json={"retailer": "Total Wine", "price": 10.00},
        headers=admin_headers,
    )
    count = db_session.query(Retailer).filter_by(name="Total Wine").count()
    assert count == 1


def test_create_listing_unknown_wine_returns_404(client, admin_headers):
    response = client.post("/api/wines/999999/listings", json={"retailer": "Some Shop"}, headers=admin_headers)
    assert response.status_code == 404


def test_create_listing_missing_admin_key_returns_401(client, seeded_wines):
    response = client.post(f"/api/wines/{seeded_wines['wine2']}/listings", json={"retailer": "Some Shop"})
    assert response.status_code == 401


def test_update_listing_changes_price_and_bumps_last_verified(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing = wine3.listings[0]
    listing_id = listing.id
    before = listing.last_verified_at

    response = client.patch(
        f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}", json={"price": 199.99}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["price"] == 199.99

    db_session.refresh(listing)
    assert listing.last_verified_at != before


def test_update_listing_uppercases_currency(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.patch(
        f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}", json={"currency": "eur"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["currency"] == "EUR"


def test_update_listing_from_different_wine_returns_404(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}/listings/{listing_id}", json={"price": 1.00}, headers=admin_headers
    )
    assert response.status_code == 404


def test_update_listing_unknown_id_returns_404(client, admin_headers, seeded_wines):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}/listings/999999", json={"price": 1.00}, headers=admin_headers
    )
    assert response.status_code == 404


def test_delete_listing_removes_it(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.delete(f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}", headers=admin_headers)
    assert response.status_code == 204

    follow_up = client.get(f"/api/wines/{seeded_wines['wine3']}")
    assert follow_up.json()["listings"] == []


def test_delete_listing_from_different_wine_returns_404(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.delete(f"/api/wines/{seeded_wines['wine1']}/listings/{listing_id}", headers=admin_headers)
    assert response.status_code == 404


def test_delete_listing_missing_admin_key_returns_401(client, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id
    response = client.delete(f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}")
    assert response.status_code == 401


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


@pytest.fixture
def lowercase_currency_competing_listings_wine(db_session):
    winery = Winery(name="Case Test Winery", country="France", region="Loire")
    db_session.add(winery)
    db_session.flush()

    retailer = Retailer(name="Lowercase Retailer")
    db_session.add(retailer)
    db_session.flush()

    wine = Wine(winery=winery, name="Lowercase EUR Wine", vintage=2021, type="white", country="France")
    # Lowercase currency, e.g. from data that bypassed normalize_wines.py's normalization.
    # Real USD equivalent: 40.00 * 1.08 (EUR rate) = 43.20.
    wine.listings.append(RetailerListing(retailer=retailer, price=40.00, currency="eur"))
    # USD equivalent: 42.00 -- genuinely cheaper than the EUR listing's real 43.20,
    # so this listing should be picked as the wine's cheapest.
    wine.listings.append(RetailerListing(retailer=retailer, price=42.00, currency="USD"))
    db_session.add(wine)
    db_session.commit()

    return wine.id


def test_list_wines_lowercase_currency_ranked_case_insensitively(
    client, lowercase_currency_competing_listings_wine
):
    response = client.get("/api/wines", params={"q": "Lowercase EUR Wine"})
    body = response.json()
    item = body["items"][0]
    # If the SQL ranking treated lowercase "eur" as unmatched (rate 1.0 fallback), it
    # would rank the EUR listing's usd_price as 40.00 (< 42.00 USD) and pick it as
    # cheapest -- disagreeing with its true, case-insensitively converted USD value of
    # 43.20. The correctly case-insensitive ranking picks the USD listing (42.00) as
    # cheapest, and its price_usd_approx agrees with its raw price.
    assert item["price"] == 42.00
    assert item["currency"] == "USD"
    assert item["price_usd_approx"] == 42.00


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


@pytest.fixture
def wine_with_cross_currency_listings(db_session):
    winery = Winery(name="Cross Currency Cellars", country="United States", region="Sonoma")
    db_session.add(winery)
    db_session.flush()

    retailer_a = Retailer(name="Retailer A")
    retailer_b = Retailer(name="Retailer B")
    db_session.add_all([retailer_a, retailer_b])
    db_session.flush()

    wine = Wine(winery=winery, name="Cross Currency Red", vintage=2020, type="red", country="United States")
    # USD listing: raw 60.00 -> usd equiv 60.00.
    wine.listings.append(RetailerListing(retailer=retailer_a, price=60.00, currency="USD"))
    # GBP listing: raw 50.00 -> usd equiv 50.00 * 1.27 (GBP rate) = 63.50.
    # Numerically the LOWER raw price, but more expensive once converted to USD --
    # a raw-number MIN would wrongly pick this one.
    wine.listings.append(RetailerListing(retailer=retailer_b, price=50.00, currency="GBP"))
    db_session.add(wine)
    db_session.commit()

    return wine.id


def test_list_wines_cheapest_listing_within_same_wine_picked_by_usd_equivalent(
    client, wine_with_cross_currency_listings
):
    response = client.get("/api/wines", params={"q": "Cross Currency Red"})
    body = response.json()
    item = body["items"][0]
    # USD 60.00 (usd equiv 60.00) beats GBP 50.00 (usd equiv 63.50) even though GBP
    # has the numerically lower raw price -- proves the ROW_NUMBER() OVER (PARTITION
    # BY wine_id ORDER BY usd_price) inside _cheapest_listing_subquery() ranks listings
    # within a single wine by USD-equivalent value, not by raw number.
    assert item["price"] == 60.00
    assert item["currency"] == "USD"


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


def test_cors_preflight_allows_patch_method(client):
    response = client.options(
        "/api/wines/1",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PATCH",
        },
    )
    assert response.status_code == 200
    assert "PATCH" in response.headers.get("access-control-allow-methods", "")
