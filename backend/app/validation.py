from typing import Optional

PRICE_RANGE_ERROR = "min_price must not exceed max_price"


def range_invalid(low: Optional[float], high: Optional[float]) -> bool:
    return low is not None and high is not None and low > high


def price_range_invalid(min_price: Optional[float], max_price: Optional[float]) -> bool:
    return range_invalid(min_price, max_price)
