from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class RetailerListing(Base):
    __tablename__ = "retailer_listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    wine_id: Mapped[int] = mapped_column(ForeignKey("wines.id"), nullable=False)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"), nullable=False)
    price: Mapped[float | None] = mapped_column()
    currency: Mapped[str | None] = mapped_column(String(10))
    product_url: Mapped[str | None] = mapped_column(String(1000))
    availability: Mapped[str | None] = mapped_column(String(50))
    source_product_id: Mapped[str | None] = mapped_column(String(200))
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    wine: Mapped["Wine"] = relationship(back_populates="listings")
    retailer: Mapped["Retailer"] = relationship()
