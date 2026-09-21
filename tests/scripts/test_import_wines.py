import os

import pytest

from app.database.base import Base, get_engine, get_session_factory
from app.models import RetailerListing, Wine
from scripts.import_wines import ImportValidationError, import_csv

CLEANED_HEADER = (
    "name,winery,vintage,grape,grape_pct,type,country,region,subregion,"
    "abv,price,currency,sweetness,acidity,tannin,body,fruitiness,"
    "description,image_url,source_site,source_url,source_product_id\n"
)


@pytest.fixture
def test_db_url():
    url = os.environ["TEST_DATABASE_URL"]
    engine = get_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()
    return url


def _write_csv(tmp_path, rows):
    path = tmp_path / "cleaned.csv"
    path.write_text(CLEANED_HEADER + "\n".join(rows) + "\n")
    return str(path)


def test_import_csv_creates_wine_winery_grapes_and_listing(tmp_path, test_db_url):
    csv_path = _write_csv(
        tmp_path,
        [
            "Caymus Cabernet Sauvignon,Caymus Vineyards,2022,Cabernet Sauvignon;Merlot,60.0;40.0,"
            "red,United States,Napa Valley,,14.6,79.99,USD,1,3,5,5,3,Bold and rich,,"
            "Total Wine,https://example.com/wine,ABC123"
        ],
    )

    count = import_csv(csv_path, database_url=test_db_url)
    assert count == 1

    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        wine = session.query(Wine).filter_by(name="Caymus Cabernet Sauvignon").one()
        assert wine.winery.name == "Caymus Vineyards"
        assert {g.grape.name for g in wine.grapes} == {"Cabernet Sauvignon", "Merlot"}
        assert wine.tannin == 5

        listing = session.query(RetailerListing).filter_by(wine_id=wine.id).one()
        assert listing.retailer.name == "Total Wine"
        assert listing.price == 79.99
    finally:
        session.close()
        engine.dispose()


def test_import_csv_is_idempotent_on_winery_name_vintage(tmp_path, test_db_url):
    csv_path = _write_csv(
        tmp_path,
        [
            "Caymus Cabernet Sauvignon,Caymus Vineyards,2022,Cabernet Sauvignon,,red,"
            "United States,Napa Valley,,14.6,79.99,USD,1,3,5,5,3,,,"
            "Total Wine,https://example.com/wine,ABC123"
        ],
    )

    import_csv(csv_path, database_url=test_db_url)
    import_csv(csv_path, database_url=test_db_url)

    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        wines = session.query(Wine).filter_by(name="Caymus Cabernet Sauvignon").all()
        assert len(wines) == 1
        listings = session.query(RetailerListing).all()
        assert len(listings) == 2
    finally:
        session.close()
        engine.dispose()


def test_import_csv_rejects_entire_file_on_invalid_row(tmp_path, test_db_url):
    csv_path = _write_csv(
        tmp_path,
        [
            "Good Wine,Some Winery,2022,,,red,,,,,,,,,,,,,,Total Wine,https://example.com/a,1",
            "Bad Wine,Some Winery,2022,,,not-a-type,,,,,,,,,,,,,,Total Wine,https://example.com/b,2",
        ],
    )

    with pytest.raises(ImportValidationError) as exc_info:
        import_csv(csv_path, database_url=test_db_url)

    assert exc_info.value.row_errors[0][0] == 1

    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        assert session.query(Wine).count() == 0
    finally:
        session.close()
        engine.dispose()
