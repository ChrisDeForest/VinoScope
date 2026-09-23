import os
import re
import sys

import pandas as pd

BOTTLE_SIZE_PATTERN = re.compile(r"\b\d+(\.\d+)?\s?(ml|l)\b", re.IGNORECASE)

COUNTRY_ALIASES = {
    "usa": "United States",
    "us": "United States",
    "united states of america": "United States",
    "uk": "United Kingdom",
}

CURRENCY_ALIASES = {
    "euro": "EUR",
    "euros": "EUR",
    "dollar": "USD",
    "dollars": "USD",
}


def clean_text(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text if text else None


def strip_bottle_size(name):
    if name is None:
        return None
    cleaned = BOTTLE_SIZE_PATTERN.sub("", name)
    return re.sub(r"\s+", " ", cleaned).strip()


def split_grape_blend(grape_field):
    cleaned = clean_text(grape_field)
    if cleaned is None:
        return []
    blend = []
    for part in (p.strip() for p in cleaned.split(";") if p.strip()):
        if ":" in part:
            name, pct = part.split(":", 1)
            blend.append((name.strip(), float(pct.strip())))
        else:
            blend.append((part, None))
    return blend


def normalize_country(country):
    cleaned = clean_text(country)
    if cleaned is None:
        return None
    return COUNTRY_ALIASES.get(cleaned.lower(), cleaned.title())


def normalize_currency(currency):
    cleaned = clean_text(currency)
    if cleaned is None:
        return None
    return CURRENCY_ALIASES.get(cleaned.lower(), cleaned.upper())


def validate_vintage(vintage):
    cleaned = clean_text(vintage)
    if cleaned is None:
        return None
    if cleaned.upper() == "NV":
        return None
    if not re.fullmatch(r"\d{4}", cleaned):
        raise ValueError(f"Invalid vintage: {vintage!r}")
    return int(cleaned)


def normalize_row(row):
    blend = split_grape_blend(row.get("grape"))
    return {
        "name": strip_bottle_size(clean_text(row.get("name"))),
        "winery": clean_text(row.get("winery")),
        "vintage": validate_vintage(row.get("vintage")),
        "grape": ";".join(name for name, _ in blend),
        "grape_pct": ";".join("" if pct is None else str(pct) for _, pct in blend),
        "type": clean_text(row.get("type")),
        "country": normalize_country(row.get("country")),
        "region": clean_text(row.get("region")),
        "subregion": clean_text(row.get("subregion")),
        "abv": clean_text(row.get("abv")),
        "price": clean_text(row.get("price")),
        "currency": normalize_currency(row.get("currency")),
        "sweetness": clean_text(row.get("sweetness")),
        "acidity": clean_text(row.get("acidity")),
        "tannin": clean_text(row.get("tannin")),
        "body": clean_text(row.get("body")),
        "fruitiness": clean_text(row.get("fruitiness")),
        "description": clean_text(row.get("description")),
        "image_url": clean_text(row.get("image_url")),
        "source_site": clean_text(row.get("source_site")),
        "source_url": clean_text(row.get("source_url")),
        "source_product_id": clean_text(row.get("source_product_id")),
    }


def normalize_csv(input_path, output_path):
    df = pd.read_csv(input_path, dtype=str)
    rows = [normalize_row(row) for _, row in df.iterrows()]
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    out_df = pd.DataFrame(rows)
    if "vintage" in out_df.columns:
        # A blank vintage anywhere in the batch upcasts an all-int column to
        # float64 (pandas has no native nullable int), which would otherwise
        # write "2023.0" instead of "2023" for every other row.
        out_df["vintage"] = out_df["vintage"].astype("Int64")
    out_df.to_csv(output_path, index=False)


if __name__ == "__main__":
    normalize_csv(sys.argv[1], sys.argv[2])
