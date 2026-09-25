import pandas as pd
import pytest
from PIL import Image

from scripts.process_wine_images import CANVAS_SIZE, CLEANED_CSV, MANIFEST_PATH, OUT_DIR, ROOT, read_wines_csv

PUBLIC_DIR = ROOT / "frontend" / "public"


def _wines_without_images(wines):
    assert "image_url" in wines.columns, (
        "the cleaned CSV is missing an image_url column -- run scripts/process_wine_images.py process first"
    )
    return [
        f"{row['winery']} — {row['name']}"
        for _, row in wines.iterrows()
        if not row["image_url"] or not (PUBLIC_DIR / row["image_url"].lstrip("/")).is_file()
    ]


def test_every_manifest_wine_has_a_canvas_sized_image():
    manifest = read_wines_csv(MANIFEST_PATH)
    assert manifest["slug"].is_unique
    missing, wrong_size = [], []
    for slug in manifest["slug"]:
        path = OUT_DIR / f"{slug}.webp"
        if not path.is_file():
            missing.append(slug)
            continue
        with Image.open(path) as image:
            if image.size != CANVAS_SIZE or image.mode != "RGBA":
                wrong_size.append(f"{slug} {image.size} {image.mode}")
    assert missing == [], f"{len(missing)} wines without images: {missing[:10]}"
    assert wrong_size == [], f"images not on the {CANVAS_SIZE} RGBA canvas: {wrong_size[:10]}"


def test_no_image_without_a_manifest_row():
    slugs = set(read_wines_csv(MANIFEST_PATH)["slug"])
    orphans = sorted(path.stem for path in OUT_DIR.glob("*.webp") if path.stem not in slugs)
    assert orphans == []


@pytest.mark.skipif(not CLEANED_CSV.exists(), reason="the 200-wine CSV is kept out of git")
def test_every_wine_in_the_cleaned_csv_points_at_an_image_file():
    wines = read_wines_csv(CLEANED_CSV)
    missing = _wines_without_images(wines)
    assert missing == [], f"{len(missing)} wines without images: {missing[:10]}"


def test_missing_image_url_column_fails_with_a_clear_message_not_a_keyerror():
    wines = pd.DataFrame([{"winery": "Test Winery", "name": "Test Wine"}])
    with pytest.raises(AssertionError, match="image_url"):
        _wines_without_images(wines)
