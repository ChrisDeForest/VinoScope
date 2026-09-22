from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.wine import WineListItem


class RecommendationRequest(BaseModel):
    sweetness: Optional[int] = Field(default=None, ge=1, le=5)
    acidity: Optional[int] = Field(default=None, ge=1, le=5)
    tannin: Optional[int] = Field(default=None, ge=1, le=5)
    body: Optional[int] = Field(default=None, ge=1, le=5)
    fruitiness: Optional[int] = Field(default=None, ge=1, le=5)
    type: Optional[str] = None
    country: Optional[str] = None
    min_price: Optional[float] = Field(default=None, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ProfileOut(BaseModel):
    description: list[str]


class RecommendationItem(WineListItem):
    match_score: float
    explanation: list[str]


class RecommendationResponse(BaseModel):
    profile: ProfileOut
    total: int
    items: list[RecommendationItem]
