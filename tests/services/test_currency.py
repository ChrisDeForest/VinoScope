from app.services.currency import CURRENCY_RATES, approx_usd, rate_for


def test_rate_for_known_currency_returns_table_value():
    assert rate_for("EUR") == CURRENCY_RATES["EUR"]


def test_rate_for_is_case_insensitive():
    assert rate_for("eur") == CURRENCY_RATES["EUR"]


def test_rate_for_unknown_currency_returns_one():
    assert rate_for("XYZ") == 1.0


def test_rate_for_none_returns_one():
    assert rate_for(None) == 1.0


def test_approx_usd_converts_using_rate():
    assert approx_usd(50.0, "EUR") == round(50.0 * CURRENCY_RATES["EUR"], 2)


def test_approx_usd_unknown_currency_returns_price_unchanged():
    assert approx_usd(50.0, "XYZ") == 50.0


def test_approx_usd_none_currency_returns_price_unchanged():
    assert approx_usd(50.0, None) == 50.0


def test_approx_usd_none_price_returns_none():
    assert approx_usd(None, "EUR") is None
