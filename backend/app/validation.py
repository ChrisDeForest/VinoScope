from typing import Optional

PRICE_RANGE_ERROR = "min_price must not exceed max_price"


def price_range_invalid(min_price: Optional[float], max_price: Optional[float]) -> bool:
    return min_price is not None and max_price is not None and min_price > max_price
