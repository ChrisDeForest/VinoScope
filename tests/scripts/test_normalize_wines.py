import pandas as pd
import pytest

from scripts.normalize_wines import (
    clean_text,
    normalize_country,
    normalize_csv,
    normalize_row,
    split_grape_blend,
    strip_bottle_size,
    validate_vintage,
)


def test_clean_text_strips_whitespace_and_treats_blank_as_none():
    assert clean_text("  Caymus  ") == "Caymus"
    assert clean_text("") is None
    assert clean_text(None) is None
    assert clean_text(float("nan")) is None


def test_strip_bottle_size_removes_size_and_extra_whitespace():
    assert strip_bottle_size("Caymus Cabernet 750ml") == "Caymus Cabernet"
    assert strip_bottle_size("Caymus Cabernet 1.5L") == "Caymus Cabernet"
    assert strip_bottle_size("Caymus Cabernet") == "Caymus Cabernet"


def test_split_grape_blend_parses_multiple_grapes_with_percentages():
    blend = split_grape_blend("Cabernet Sauvignon:60;Merlot:40")
    assert blend == [("Cabernet Sauvignon", 60.0), ("Merlot", 40.0)]


def test_split_grape_blend_handles_single_grape_without_percentage():
    assert split_grape_blend("Chardonnay") == [("Chardonnay", None)]


def test_split_grape_blend_handles_blank_field():
    assert split_grape_blend("") == []
    assert split_grape_blend(None) == []


def test_normalize_country_applies_known_aliases():
    assert normalize_country("usa") == "United States"
    assert normalize_country("US") == "United States"


def test_normalize_country_title_cases_unknown_values():
    assert normalize_country("france") == "France"


def test_validate_vintage_accepts_four_digit_year():
    assert validate_vintage("2022") == 2022


def test_validate_vintage_allows_blank():
    assert validate_vintage("") is None
    assert validate_vintage(None) is None


def test_validate_vintage_rejects_non_year_value():
    with pytest.raises(ValueError):
        validate_vintage("22")


def test_validate_vintage_accepts_nv_case_insensitive():
    assert validate_vintage("NV") is None
    assert validate_vintage("nv") is None
    assert validate_vintage("Nv") is None


def test_normalize_row_produces_expected_fields():
    row = {
        "name": " Caymus Cabernet Sauvignon 750ml ",
        "winery": "Caymus Vineyards",
        "vintage": "2022",
        "grape": "Cabernet Sauvignon:60;Merlot:40",
        "type": "red",
        "country": "usa",
        "region": "Napa Valley",
    }
    result = normalize_row(row)
    assert result["name"] == "Caymus Cabernet Sauvignon"
    assert result["vintage"] == 2022
    assert result["grape"] == "Cabernet Sauvignon;Merlot"
    assert result["grape_pct"] == "60.0;40.0"
    assert result["country"] == "United States"


def test_normalize_csv_writes_cleaned_output(tmp_path):
    input_csv = tmp_path / "raw.csv"
    input_csv.write_text(
        "name,winery,vintage,grape,grape_pct,type,country,region,subregion,"
        "abv,price,currency,sweetness,acidity,tannin,body,fruitiness,"
        "description,image_url,source_site,source_url,source_product_id\n"
        "Caymus Cabernet Sauvignon 750ml,Caymus Vineyards,2022,"
        "Cabernet Sauvignon:60;Merlot:40,,red,usa,Napa Valley,,14.6,79.99,"
        "USD,1,3,5,5,3,Bold and rich,,Total Wine,https://example.com,ABC123\n"
    )
    output_csv = tmp_path / "cleaned.csv"

    normalize_csv(str(input_csv), str(output_csv))

    out_df = pd.read_csv(output_csv, dtype=str)
    assert out_df.loc[0, "name"] == "Caymus Cabernet Sauvignon"
    assert out_df.loc[0, "country"] == "United States"
    assert out_df.loc[0, "grape"] == "Cabernet Sauvignon;Merlot"
