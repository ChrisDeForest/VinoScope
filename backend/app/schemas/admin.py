from typing import Optional

from pydantic import BaseModel


class ColumnStats(BaseModel):
    count: int
    null_count: int
    min: Optional[float] = None
    max: Optional[float] = None
    avg: Optional[float] = None


class AdminStats(BaseModel):
    wines_count: int
    wineries_count: int
    retailers_count: int
    listings_count: int
    numeric: dict[str, ColumnStats]
    categorical: dict[str, dict[str, int]]
