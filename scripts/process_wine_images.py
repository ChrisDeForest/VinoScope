import re
import unicodedata
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CLEANED_CSV = ROOT / "data" / "cleaned" / "wines_combined_200_currency_audited.csv"
RAW_CSV = ROOT / "data" / "raw" / "wines_combined_200_currency_audited.csv"
MANIFEST_PATH = ROOT / "data" / "images" / "manifest.csv"
RAW_DIR = ROOT / "data" / "images" / "raw"
OUT_DIR = ROOT / "frontend" / "public" / "wines"

MANIFEST_COLUMNS = ["slug", "winery", "name", "vintage", "type", "source", "source_url", "notes"]
RESEARCH_COLUMNS = ["source", "source_url", "notes"]
UTF8_BOM = b"\xef\xbb\xbf"


def slugify(text):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def normalize_vintage(vintage):
    value = (vintage or "").strip()
    return "" if value.upper() == "NV" else value


def wine_slug(winery, name, vintage):
    return slugify(f"{winery} {name} {normalize_vintage(vintage) or 'nv'}")


def has_bom(path):
    with open(path, "rb") as handle:
        return handle.read(3) == UTF8_BOM


def read_wines_csv(path):
    return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")


def write_wines_csv(df, path, bom):
    df.to_csv(path, index=False, encoding="utf-8-sig" if bom else "utf-8")


def _slugs(wines):
    return [wine_slug(w, n, v) for w, n, v in zip(wines["winery"], wines["name"], wines["vintage"])]


def build_manifest(wines, existing=None):
    manifest = pd.DataFrame(
        {
            "slug": _slugs(wines),
            "winery": wines["winery"].values,
            "name": wines["name"].values,
            "vintage": [normalize_vintage(v) for v in wines["vintage"]],
            "type": wines["type"].values,
            "source": "",
            "source_url": "",
            "notes": "",
        },
        columns=MANIFEST_COLUMNS,
    )
    if existing is not None and not existing.empty:
        known = existing.set_index("slug")[RESEARCH_COLUMNS]
        for column in RESEARCH_COLUMNS:
            mapped = manifest["slug"].map(known[column])
            manifest[column] = mapped.fillna(manifest[column])
    return manifest


def set_image_urls(wines, urls):
    updated = wines.copy()
    for index, slug in zip(updated.index, _slugs(updated)):
        if slug in urls:
            updated.at[index, "image_url"] = urls[slug]
    return updated
