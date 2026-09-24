import pytest

from app.models import Retailer, RetailerListing, Wine, Winery


@pytest.fixture
def stats_wines(db_session):
    winery = Winery(name="Stats Cellars", country="United States", region="Somewhere")
    db_session.add(winery)
    db_session.flush()
    retailer = Retailer(name="Stats Retailer")
    db_session.add(retailer)
    db_session.flush()

    wine1 = Wine(
        winery=winery,
        name="Stats Wine A",
        vintage=2020,
        type="red",
        country="United States",
        sweetness=1,
        acidity=3,
        tannin=5,
        body=3,
        fruitiness=3,
        abv=13.0,
    )
    wine1.listings.append(RetailerListing(retailer=retailer, price=50.0, currency="USD", availability="In Stock"))

    wine2 = Wine(
        winery=winery,
        name="Stats Wine B",
        vintage=2022,
        type="white",
        country="France",
    )
    wine2.listings.append(RetailerListing(retailer=retailer))

    db_session.add_all([wine1, wine2])
    db_session.commit()
    return {"wine1": wine1.id, "wine2": wine2.id}


def test_get_admin_stats_counts(client, admin_headers, stats_wines):
    response = client.get("/api/admin/stats", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["wines_count"] == 2
    assert body["wineries_count"] == 1
    assert body["retailers_count"] == 1
    assert body["listings_count"] == 2


def test_get_admin_stats_numeric_aggregates(client, admin_headers, stats_wines):
    response = client.get("/api/admin/stats", headers=admin_headers)
    body = response.json()
    assert body["numeric"]["vintage"] == {"count": 2, "null_count": 0, "min": 2020.0, "max": 2022.0, "avg": 2021.0}
    assert body["numeric"]["sweetness"] == {"count": 1, "null_count": 1, "min": 1.0, "max": 1.0, "avg": 1.0}
    assert body["numeric"]["abv"] == {"count": 1, "null_count": 1, "min": 13.0, "max": 13.0, "avg": 13.0}
    assert body["numeric"]["price"] == {"count": 1, "null_count": 1, "min": 50.0, "max": 50.0, "avg": 50.0}


def test_get_admin_stats_price_reflects_usd_conversion_not_raw_currency(client, admin_headers, db_session):
    winery = Winery(name="Mixed Currency Cellars", country="United States", region="Somewhere")
    db_session.add(winery)
    db_session.flush()
    retailer = Retailer(name="Mixed Currency Retailer")
    db_session.add(retailer)
    db_session.flush()

    # 50.00 EUR ~= $54.00 USD (rate 1.08) -- raw price and USD-equivalent price differ.
    wine = Wine(winery=winery, name="Euro Wine", vintage=2021, type="red", country="France")
    wine.listings.append(RetailerListing(retailer=retailer, price=50.0, currency="EUR"))
    db_session.add(wine)
    db_session.commit()

    response = client.get("/api/admin/stats", headers=admin_headers)
    body = response.json()
    assert "price_usd_approx" not in body["numeric"]
    assert body["numeric"]["price"] == {"count": 1, "null_count": 0, "min": 54.0, "max": 54.0, "avg": 54.0}


def test_get_admin_stats_categorical_counts(client, admin_headers, stats_wines):
    response = client.get("/api/admin/stats", headers=admin_headers)
    body = response.json()
    assert body["categorical"]["type"] == {"red": 1, "white": 1}
    assert body["categorical"]["country"] == {"United States": 1, "France": 1}
    assert body["categorical"]["currency"] == {"USD": 1}


def test_get_admin_stats_empty_database_has_no_crash(client, admin_headers):
    response = client.get("/api/admin/stats", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["wines_count"] == 0
    assert body["numeric"]["vintage"] == {"count": 0, "null_count": 0, "min": None, "max": None, "avg": None}
    assert body["categorical"]["type"] == {}


def test_get_admin_stats_missing_admin_key_returns_401(client, stats_wines):
    response = client.get("/api/admin/stats")
    assert response.status_code == 401
