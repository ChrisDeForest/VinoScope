import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from dotenv import load_dotenv

load_dotenv()

from app.database.base import get_engine, get_session_factory
from app.models import RetailerListing, Wine, Winery


def summarize(database_url=None):
    engine = get_engine(database_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        wine_count = session.query(Wine).count()
        winery_count = session.query(Winery).count()
        listing_count = session.query(RetailerListing).count()
        sample = session.query(Wine).order_by(Wine.id).limit(3).all()
        return {
            "wine_count": wine_count,
            "winery_count": winery_count,
            "listing_count": listing_count,
            "sample": [(w.name, w.winery.name, w.vintage) for w in sample],
        }
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    summary = summarize(os.environ.get("DATABASE_URL"))
    print(f"Wines: {summary['wine_count']}")
    print(f"Wineries: {summary['winery_count']}")
    print(f"Retailer listings: {summary['listing_count']}")
    print("Sample:")
    for name, winery, vintage in summary["sample"]:
        print(f"  - {name} ({winery}, {vintage})")
