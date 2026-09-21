import os

from app.database.base import Base, get_engine, get_session_factory
from app.models import Winery, Grape, Wine, WineGrape, Retailer, RetailerListing


def _fresh_session():
    engine = get_engine(os.environ["TEST_DATABASE_URL"])
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = get_session_factory(engine)
    return Session(), engine


def test_wine_with_winery_grapes_and_listing_round_trips():
    session, engine = _fresh_session()
    try:
        winery = Winery(name="Caymus Vineyards", country="USA", region="Napa Valley")
        cab = Grape(name="Cabernet Sauvignon")
        merlot = Grape(name="Merlot")
        wine = Wine(
            winery=winery,
            name="Caymus Cabernet Sauvignon",
            vintage=2022,
            type="red",
            country="USA",
            region="Napa Valley",
            abv=14.6,
            sweetness=1,
            acidity=3,
            tannin=5,
            body=5,
            fruitiness=3,
        )
        wine.grapes.append(WineGrape(grape=cab, percentage=60))
        wine.grapes.append(WineGrape(grape=merlot, percentage=40))
        retailer = Retailer(name="Total Wine")
        wine.listings.append(
            RetailerListing(
                retailer=retailer,
                price=79.99,
                currency="USD",
                product_url="https://example.com/wine",
            )
        )

        session.add(wine)
        session.commit()

        stored = session.query(Wine).filter_by(name="Caymus Cabernet Sauvignon").one()
        assert stored.winery.name == "Caymus Vineyards"
        assert {g.grape.name for g in stored.grapes} == {"Cabernet Sauvignon", "Merlot"}
        assert stored.listings[0].retailer.name == "Total Wine"
        assert stored.sweetness == 1
        assert stored.tannin == 5
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_wine_rating_columns_are_nullable():
    session, engine = _fresh_session()
    try:
        winery = Winery(name="Unrated Winery")
        wine = Wine(winery=winery, name="Unrated Wine", type="red")
        session.add(wine)
        session.commit()

        stored = session.query(Wine).filter_by(name="Unrated Wine").one()
        assert stored.sweetness is None
        assert stored.acidity is None
        assert stored.tannin is None
        assert stored.body is None
        assert stored.fruitiness is None
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()
