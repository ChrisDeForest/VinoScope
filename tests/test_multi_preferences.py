import pytest
from pydantic import ValidationError
from app.models import Wine
from app.schemas.recommendation import RecommendationRequest
from app.services.recommendations import _distance, build_profile, build_explanation


def test_nearest_selected_level_and_equal_dimension_weights():
    assert _distance({"sweetness": [2, 4]}, Wine(sweetness=2)) == 0
    assert _distance({"sweetness": [2, 4]}, Wine(sweetness=4)) == 0
    assert _distance({"sweetness": [2, 4]}, Wine(sweetness=3)) == 1
    assert _distance({"sweetness": [2, 4], "body": [5]}, Wine(sweetness=3, body=3)) == pytest.approx(2.5 ** 0.5)
    assert _distance({"sweetness": []}, Wine(sweetness=3)) == 0
    # User asked for something, but the wine has no data on any dimension asked
    # about: unscoreable, so it must rank worse than every real comparison,
    # not tie with a perfect match.
    assert _distance({"sweetness": [2, 4]}, Wine()) == float("inf")
    assert _distance({"sweetness": 2}, Wine(sweetness=3)) == 1


def test_request_validation():
    assert RecommendationRequest(sweetness=[2, 4]).sweetness == [2, 4]
    assert RecommendationRequest(sweetness=2).sweetness == 2
    for value in ([0], [6], [2, 6]):
        with pytest.raises(ValidationError):
            RecommendationRequest(sweetness=value)


def test_profile_and_explanations_use_all_selected_levels():
    assert build_profile({"sweetness": [2, 4]}, None, None, None) == ["Dry to Sweet"]
    assert build_explanation({"sweetness": [1, 5]}, Wine(sweetness=5), None, None, None, None) == ["Very sweet"]
    assert build_explanation({"sweetness": [1, 5]}, Wine(sweetness=3), None, None, None, None) == []
