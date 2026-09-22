from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.recommendation import ProfileOut, RecommendationRequest, RecommendationResponse
from app.services import recommendations as recommendations_service

router = APIRouter()


@router.post("/recommendations", response_model=RecommendationResponse)
def get_recommendations(
    request: RecommendationRequest,
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    total, profile, items = recommendations_service.get_recommendations(
        db,
        sweetness=request.sweetness,
        acidity=request.acidity,
        tannin=request.tannin,
        body=request.body,
        fruitiness=request.fruitiness,
        type=request.type,
        country=request.country,
        min_price=request.min_price,
        max_price=request.max_price,
        limit=request.limit,
        offset=request.offset,
    )
    return RecommendationResponse(profile=ProfileOut(description=profile), total=total, items=items)
