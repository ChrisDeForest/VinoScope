from typing import Optional

from pydantic import BaseModel


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
    product_url: Optional[str] = None
    availability: Optional[str] = None


class WineDetail(WineListItem):
    subregion: Optional[str] = None
    abv: Optional[float] = None
    description: Optional[str] = None
    listings: list[RetailerListingOut]
