from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_TYPES = {"red", "white", "rosé", "sparkling", "dessert", "fortified"}
RatingLevel = Annotated[int, Field(ge=1, le=5)]


def _validate_product_url(value):
    if value is None:
        return value
    if not (value.startswith("http://") or value.startswith("https://")):
        raise ValueError("product_url must start with http:// or https://")
    return value


class WineUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[Annotated[str, Field(max_length=300)]] = None
    winery: Optional[Annotated[str, Field(max_length=200)]] = None
    vintage: Optional[int] = None
    type: Optional[Annotated[str, Field(max_length=20)]] = None
    country: Optional[Annotated[str, Field(max_length=100)]] = None
    region: Optional[Annotated[str, Field(max_length=100)]] = None
    subregion: Optional[Annotated[str, Field(max_length=100)]] = None
    abv: Optional[Annotated[float, Field(ge=0, le=100)]] = None
    sweetness: Optional[RatingLevel] = None
    acidity: Optional[RatingLevel] = None
    tannin: Optional[RatingLevel] = None
    body: Optional[RatingLevel] = None
    fruitiness: Optional[RatingLevel] = None
    description: Optional[str] = None
    image_url: Optional[Annotated[str, Field(max_length=1000)]] = None

    @field_validator("type")
    @classmethod
    def _validate_type(cls, value):
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in VALID_TYPES:
            raise ValueError(f"invalid type {value!r}")
        return normalized

    @field_validator("name", "type", "winery")
    @classmethod
    def _reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("field cannot be null")
        return value


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
    id: int
    retailer: str
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None


class RetailerListingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    retailer: Annotated[str, Field(max_length=200)]
    price: Optional[Annotated[float, Field(ge=0)]] = None
    currency: Optional[Annotated[str, Field(max_length=10)]] = None
    availability: Optional[Annotated[str, Field(max_length=50)]] = None
    product_url: Optional[Annotated[str, Field(max_length=1000)]] = None

    @field_validator("currency")
    @classmethod
    def _uppercase_currency(cls, value):
        return value.upper() if value is not None else value

    @field_validator("product_url")
    @classmethod
    def _validate_product_url(cls, value):
        return _validate_product_url(value)


class RetailerListingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price: Optional[Annotated[float, Field(ge=0)]] = None
    currency: Optional[Annotated[str, Field(max_length=10)]] = None
    availability: Optional[Annotated[str, Field(max_length=50)]] = None
    product_url: Optional[Annotated[str, Field(max_length=1000)]] = None

    @field_validator("currency")
    @classmethod
    def _uppercase_currency(cls, value):
        return value.upper() if value is not None else value

    @field_validator("product_url")
    @classmethod
    def _validate_product_url(cls, value):
        return _validate_product_url(value)


class WineDetail(WineListItem):
    subregion: Optional[str] = None
    abv: Optional[float] = None
    description: Optional[str] = None
    listings: list[RetailerListingOut]
