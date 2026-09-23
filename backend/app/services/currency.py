# Approximate USD value per 1 unit of the given currency.
# Hand-maintained, not live — refresh occasionally by hand.
CURRENCY_RATES: dict[str, float] = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.27,
    "CAD": 0.74,
    "AUD": 0.66,
    "CHF": 1.13,
    "JPY": 0.0067,
    "ZAR": 0.055,
    "HUF": 0.0028,
    "NZD": 0.61,
}


def rate_for(currency: str | None) -> float:
    """Approximate USD rate for a currency code. Unknown/blank -> 1.0 (treated as already-USD)."""
    if currency is None:
        return 1.0
    return CURRENCY_RATES.get(currency.upper(), 1.0)


def approx_usd(price: float | None, currency: str | None) -> float | None:
    """Approximate USD value of a price, rounded to 2dp. None price in, None out."""
    if price is None:
        return None
    return round(price * rate_for(currency), 2)
