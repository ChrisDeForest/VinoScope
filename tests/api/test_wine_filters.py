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


def test_min_abv_excludes_lower_and_unknown_abv(client, filterable_wines):
    assert names(client.get("/api/wines", params={"min_abv": 12.5})) == ["NV Bubbles", "Old Red", "Port"]


def test_max_abv(client, filterable_wines):
    assert names(client.get("/api/wines", params={"max_abv": 12.5})) == ["NV Bubbles", "Young White"]


def test_vintage_range_keeps_nv_by_default(client, filterable_wines):
    response = client.get("/api/wines", params={"vintage_from": 2019, "vintage_to": 2020})
    assert names(response) == ["Mystery", "NV Bubbles", "Port"]


def test_vintage_range_can_drop_nv(client, filterable_wines):
    response = client.get("/api/wines", params={"vintage_from": 2019, "vintage_to": 2020, "include_nv": "false"})
    assert names(response) == ["Mystery", "Port"]


def test_include_nv_false_alone_drops_only_nv(client, filterable_wines):
    assert names(client.get("/api/wines", params={"include_nv": "false"})) == [
        "Mystery", "Old Red", "Port", "Young White",
    ]


def test_taste_range_single_level(client, filterable_wines):
    response = client.get("/api/wines", params={"min_sweetness": 2, "max_sweetness": 2})
    assert names(response) == ["NV Bubbles", "Young White"]


def test_taste_bound_excludes_unscored_wines(client, filterable_wines):
    assert names(client.get("/api/wines", params={"min_tannin": 1})) == ["Old Red", "Port", "Young White"]


def test_taste_ranges_combine(client, filterable_wines):
    response = client.get("/api/wines", params={"min_body": 4, "max_acidity": 3})
    assert names(response) == ["Old Red", "Port"]


@pytest.mark.parametrize(
    "params, detail",
    [
        ({"min_abv": 14, "max_abv": 12}, "min_abv must not exceed max_abv"),
        ({"vintage_from": 2022, "vintage_to": 2019}, "vintage_from must not exceed vintage_to"),
        ({"min_body": 4, "max_body": 2}, "min_body must not exceed max_body"),
    ],
)
def test_inverted_ranges_return_422(client, filterable_wines, params, detail):
    response = client.get("/api/wines", params=params)
    assert response.status_code == 422
    assert response.json()["detail"] == detail


@pytest.mark.parametrize("params", [{"min_acidity": 0}, {"max_fruitiness": 6}, {"min_abv": -1}])
def test_out_of_range_values_return_422(client, filterable_wines, params):
    assert client.get("/api/wines", params=params).status_code == 422


@pytest.mark.parametrize("param", ["q", "type", "country", "region", "grape"])
def test_free_text_filters_accept_up_to_100_characters(client, filterable_wines, param):
    response = client.get("/api/wines", params={param: "x" * 100})
    assert response.status_code == 200, response.text


@pytest.mark.parametrize("param", ["q", "type", "country", "region", "grape"])
def test_free_text_filters_reject_longer_values(client, filterable_wines, param):
    response = client.get("/api/wines", params={param: "x" * 101})
    assert response.status_code == 422
