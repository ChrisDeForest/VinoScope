from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class WineGrape(Base):
    __tablename__ = "wine_grapes"

    wine_id: Mapped[int] = mapped_column(ForeignKey("wines.id"), primary_key=True)
    grape_id: Mapped[int] = mapped_column(ForeignKey("grapes.id"), primary_key=True)
    percentage: Mapped[float | None] = mapped_column()

    wine: Mapped["Wine"] = relationship(back_populates="grapes")
    grape: Mapped["Grape"] = relationship()
