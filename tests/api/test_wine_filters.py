import pytest

from app.models import Wine, Winery


@pytest.fixture
def filterable_wines(db_session):
    winery = Winery(name="Filter Test Estate", country="Chile", region="Maipo Valley")
    db_session.add(winery)
    db_session.flush()

    def add(name, **fields):
        fields.setdefault("type", "red")
        db_session.add(Wine(winery=winery, name=name, **fields))

    add("Old Red", country="Chile", region="Maipo Valley", vintage=2016, abv=13.0,
        sweetness=1, acidity=3, tannin=4, body=4, fruitiness=3)
    add("Young White", type="white", country="Chile", region="Casablanca Valley", vintage=2023, abv=12.0,
        sweetness=2, acidity=5, tannin=1, body=2, fruitiness=4)
    add("NV Bubbles", type="sparkling", country="France", region="Champagne", vintage=None, abv=12.5,
        sweetness=2, acidity=5, tannin=None, body=2, fruitiness=3)
    add("Port", type="fortified", country="Portugal", region="Douro", vintage=2020, abv=20.0,
        sweetness=5, acidity=3, tannin=4, body=5, fruitiness=5)
    add("Mystery", country="Chile", region=None, vintage=2019)
    db_session.commit()


def names(response):
    assert response.status_code == 200, response.text
    return sorted(item["name"] for item in response.json()["items"])


def test_facets_lists_catalog_options_sorted(client, filterable_wines):
    response = client.get("/api/wines/facets")
    assert response.status_code == 200
    assert response.json() == {
        "types": ["fortified", "red", "sparkling", "white"],
        "countries": [
            {"name": "Chile", "regions": ["Casablanca Valley", "Maipo Valley"]},
            {"name": "France", "regions": ["Champagne"]},
            {"name": "Portugal", "regions": ["Douro"]},
        ],
        "vintage": {"min": 2016, "max": 2023},
        "abv": {"min": 12.0, "max": 20.0},
    }


def test_facets_on_empty_catalog(client, db_session):
    response = client.get("/api/wines/facets")
    assert response.status_code == 200
    assert response.json() == {
        "types": [],
        "countries": [],
        "vintage": {"min": None, "max": None},
        "abv": {"min": None, "max": None},
    }
