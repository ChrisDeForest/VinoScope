import os

import pytest

from app.database.base import Base, get_engine, get_session_factory
from app.models import Wine, Winery
from scripts.verify_import import summarize


@pytest.fixture
def test_db_url():
    url = os.environ["TEST_DATABASE_URL"]
    engine = get_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()
    return url


def test_summarize_counts_wines_wineries_and_listings(test_db_url):
    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    winery = Winery(name="Caymus Vineyards")
    wine = Wine(winery=winery, name="Caymus Cabernet Sauvignon", vintage=2022, type="red")
    session.add(wine)
    session.commit()
    session.close()
    engine.dispose()

    summary = summarize(test_db_url)

    assert summary["wine_count"] == 1
    assert summary["winery_count"] == 1
    assert summary["listing_count"] == 0
    assert summary["sample"] == [("Caymus Cabernet Sauvignon", "Caymus Vineyards", 2022)]
