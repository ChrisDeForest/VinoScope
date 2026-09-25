import argparse
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CLEANED_CSV = ROOT / "data" / "cleaned" / "wines_combined_200_currency_audited.csv"
RAW_CSV = ROOT / "data" / "raw" / "wines_combined_200_currency_audited.csv"
MANIFEST_PATH = ROOT / "data" / "images" / "manifest.csv"
RAW_DIR = ROOT / "data" / "images" / "raw"
OUT_DIR = ROOT / "frontend" / "public" / "wines"

MANIFEST_COLUMNS = ["slug", "winery", "name", "vintage", "type", "source", "source_url", "notes"]
RESEARCH_COLUMNS = ["source", "source_url", "notes"]
UTF8_BOM = b"\xef\xbb\xbf"

CANVAS_SIZE = (600, 900)
MAX_BOTTLE_SIZE = (540, 860)
WEBP_QUALITY = 85


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


def fit_on_canvas(image):
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("image is fully transparent after background removal")
    bottle = rgba.crop(bbox)
    scale = min(MAX_BOTTLE_SIZE[0] / bottle.width, MAX_BOTTLE_SIZE[1] / bottle.height)
    bottle = bottle.resize((round(bottle.width * scale), round(bottle.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    offset = ((CANVAS_SIZE[0] - bottle.width) // 2, (CANVAS_SIZE[1] - bottle.height) // 2)
    canvas.paste(bottle, offset, bottle)
    return canvas


def process_image(raw_path, out_path, remover):
    with Image.open(raw_path) as source:
        cutout = remover(source.convert("RGBA"))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fit_on_canvas(cutout).save(out_path, "WEBP", quality=WEBP_QUALITY)


def rembg_remover():
    from rembg import new_session, remove

    session = new_session("isnet-general-use")
    return lambda image: remove(image, session=session)


def find_raw_image(slug):
    matches = sorted(RAW_DIR.glob(f"{slug}.*"))
    return matches[0] if matches else None


def init_manifest():
    existing = read_wines_csv(MANIFEST_PATH) if MANIFEST_PATH.exists() else None
    manifest = build_manifest(read_wines_csv(CLEANED_CSV), existing)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    write_wines_csv(manifest, MANIFEST_PATH, bom=False)
    print(f"Wrote {len(manifest)} rows to {MANIFEST_PATH}")


def process_all(only=None, force=False):
    manifest = read_wines_csv(MANIFEST_PATH)
    remover = None
    missing = []
    for slug in manifest["slug"]:
        if only and slug != only:
            continue
        out_path = OUT_DIR / f"{slug}.webp"
        if out_path.exists() and not force:
            continue
        raw_path = find_raw_image(slug)
        if raw_path is None:
            missing.append(slug)
            continue
        remover = remover or rembg_remover()
        process_image(raw_path, out_path, remover)
        print(f"processed {slug}")

    urls = {slug: f"/wines/{slug}.webp" for slug in manifest["slug"] if (OUT_DIR / f"{slug}.webp").exists()}
    for csv_path in (RAW_CSV, CLEANED_CSV):
        bom = has_bom(csv_path)
        write_wines_csv(set_image_urls(read_wines_csv(csv_path), urls), csv_path, bom)
    print(f"{len(urls)}/{len(manifest)} wines have images; {len(missing)} without a raw file")
    for slug in missing:
        print(f"  missing raw: {slug}")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Build and process wine bottle images.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-manifest", help="Create or refresh data/images/manifest.csv")
    process = commands.add_parser("process", help="Cut out raw images and update CSV image_url")
    process.add_argument("--only", help="Process a single slug")
    process.add_argument("--force", action="store_true", help="Reprocess even if output exists")
    args = parser.parse_args(argv)
    if args.command == "init-manifest":
        init_manifest()
    else:
        process_all(only=args.only, force=args.force)


if __name__ == "__main__":
    sys.exit(main())
