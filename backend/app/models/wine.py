from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Wine(Base):
    __tablename__ = "wines"

    id: Mapped[int] = mapped_column(primary_key=True)
    winery_id: Mapped[int] = mapped_column(ForeignKey("wineries.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    vintage: Mapped[int | None] = mapped_column()
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    subregion: Mapped[str | None] = mapped_column(String(100))
    abv: Mapped[float | None] = mapped_column()
    sweetness: Mapped[int | None] = mapped_column()
    acidity: Mapped[int | None] = mapped_column()
    tannin: Mapped[int | None] = mapped_column()
    body: Mapped[int | None] = mapped_column()
    fruitiness: Mapped[int | None] = mapped_column()
    description: Mapped[str | None] = mapped_column(String)
    image_url: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    winery: Mapped["Winery"] = relationship(back_populates="wines")
    grapes: Mapped[list["WineGrape"]] = relationship(back_populates="wine", cascade="all, delete-orphan")
    listings: Mapped[list["RetailerListing"]] = relationship(back_populates="wine")
