from typing import Annotated, Optional

from pydantic import BaseModel, Field, field_validator

VALID_TYPES = {"red", "white", "rosé", "sparkling", "dessert", "fortified"}
RatingLevel = Annotated[int, Field(ge=1, le=5)]


class WineUpdate(BaseModel):
    name: Optional[str] = None
    winery: Optional[str] = None
    vintage: Optional[int] = None
    type: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    subregion: Optional[str] = None
    abv: Optional[Annotated[float, Field(ge=0, le=100)]] = None
    sweetness: Optional[RatingLevel] = None
    acidity: Optional[RatingLevel] = None
    tannin: Optional[RatingLevel] = None
    body: Optional[RatingLevel] = None
    fruitiness: Optional[RatingLevel] = None
    description: Optional[str] = None
    image_url: Optional[str] = None

    @field_validator("type")
    @classmethod
    def _validate_type(cls, value):
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in VALID_TYPES:
            raise ValueError(f"invalid type {value!r}")
        return normalized


class GrapeOut(BaseModel):
    name: str
    percentage: Optional[float] = None


class WineListItem(BaseModel):
    id: int
    name: str
    winery: str
    vintage: Optional[int] = None
    type: str
    country: Optional[str] = None
    region: Optional[str] = None
    grapes: list[GrapeOut]
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    image_url: Optional[str] = None
    sweetness: Optional[int] = None
    acidity: Optional[int] = None
    tannin: Optional[int] = None
    body: Optional[int] = None
    fruitiness: Optional[int] = None


class WineListResponse(BaseModel):
    total: int
    items: list[WineListItem]


class RetailerListingOut(BaseModel):
    retailer: str
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None


class WineDetail(WineListItem):
    subregion: Optional[str] = None
    abv: Optional[float] = None
    description: Optional[str] = None
    listings: list[RetailerListingOut]
