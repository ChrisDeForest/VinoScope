import pytest
from PIL import Image

from scripts.process_wine_images import CANVAS_SIZE, CLEANED_CSV, MANIFEST_PATH, OUT_DIR, ROOT, read_wines_csv

PUBLIC_DIR = ROOT / "frontend" / "public"


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
    missing = [
        f"{row['winery']} — {row['name']}"
        for _, row in wines.iterrows()
        if not row["image_url"] or not (PUBLIC_DIR / row["image_url"].lstrip("/")).is_file()
    ]
    assert missing == [], f"{len(missing)} wines without images: {missing[:10]}"
