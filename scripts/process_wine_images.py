import argparse
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image
from scipy.ndimage import binary_fill_holes

ROOT = Path(__file__).resolve().parent.parent
CLEANED_CSV = ROOT / "data" / "cleaned" / "wines_combined_200_currency_audited.csv"
RAW_CSV = ROOT / "data" / "raw" / "wines_combined_200_currency_audited.csv"
MANIFEST_PATH = ROOT / "data" / "images" / "manifest.csv"
RAW_DIR = ROOT / "data" / "images" / "raw"
OUT_DIR = ROOT / "frontend" / "public" / "wines"

MANIFEST_COLUMNS = ["slug", "winery", "name", "vintage", "type", "source", "source_url", "notes", "process_options"]
RESEARCH_COLUMNS = ["source", "source_url", "notes"]
# Columns build_manifest carries over from an existing manifest row rather than
# regenerating blank: the research columns above, plus the per-slug processing
# overrides recorded by hand (item 3).
PRESERVED_COLUMNS = RESEARCH_COLUMNS + ["process_options"]
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
            "process_options": "",
        },
        columns=MANIFEST_COLUMNS,
    )
    if existing is not None and not existing.empty:
        if not existing["slug"].is_unique:
            duplicates = sorted(existing.loc[existing["slug"].duplicated(), "slug"].unique())
            raise ValueError(f"duplicate slug(s) in existing manifest: {', '.join(duplicates)}")
        dropped = sorted(set(existing["slug"]) - set(manifest["slug"]))
        if dropped:
            print(
                f"dropping {len(dropped)} manifest row(s) no longer in the wines CSV: {', '.join(dropped)}"
            )
        known = existing.set_index("slug")
        preserve = [column for column in PRESERVED_COLUMNS if column in known.columns]
        for column in preserve:
            mapped = manifest["slug"].map(known[column])
            manifest[column] = mapped.fillna(manifest[column])
    return manifest


def set_image_urls(wines, urls):
    updated = wines.copy()
    for index, slug in zip(updated.index, _slugs(updated)):
        if slug in urls:
            updated.at[index, "image_url"] = urls[slug]
    return updated


ALPHA_BBOX_THRESHOLD = 10


def fit_on_canvas(image):
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    # rembg sometimes leaves stray near-zero-alpha noise pixels at the image
    # edges; a plain getbbox() on the raw alpha channel treats alpha=1 as
    # "content" and produces a bbox stretched toward that noise, which then
    # off-centers the real bottle on the canvas. Threshold first so only
    # visibly-opaque pixels count toward the bounding box.
    bbox = alpha.point(lambda a: 255 if a > ALPHA_BBOX_THRESHOLD else 0).getbbox()
    if bbox is None:
        raise ValueError("image is fully transparent after background removal")
    bottle = rgba.crop(bbox)
    scale = min(MAX_BOTTLE_SIZE[0] / bottle.width, MAX_BOTTLE_SIZE[1] / bottle.height)
    bottle = bottle.resize((round(bottle.width * scale), round(bottle.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    offset = ((CANVAS_SIZE[0] - bottle.width) // 2, (CANVAS_SIZE[1] - bottle.height) // 2)
    canvas.paste(bottle, offset, bottle)
    return canvas


def fill_interior_holes(image):
    """Opacify fully-enclosed transparent regions (e.g. a glass highlight
    rembg punched out), leaving RGB untouched. rembg's remove() keeps the
    original RGB under transparent pixels, so the true colour comes back
    once alpha is restored. Regions that are still connected to the image
    border (a notch, not a hole) are left transparent."""
    rgba = image.convert("RGBA")
    arr = np.array(rgba)
    mask = arr[..., 3] > 128
    filled = binary_fill_holes(mask)
    holes = filled & ~mask
    arr[..., 3] = np.where(holes, 255, arr[..., 3])
    return Image.fromarray(arr, "RGBA")


TRANSPARENT_SHARE = 0.05


def has_transparent_background(image):
    """True when the source already ships cut out: a meaningful share of its
    pixels is fully transparent. Packshots are often cropped tight to the
    bottle, so the border alone is not a reliable signal."""
    if "A" not in image.getbands() and "transparency" not in image.info:
        return False
    alpha = np.array(image.convert("RGBA").getchannel("A"))
    return (alpha == 0).mean() >= TRANSPARENT_SHARE


def flatten_on_white(image):
    white = Image.new("RGBA", image.size, (255, 255, 255, 255))
    white.alpha_composite(image.convert("RGBA"))
    return white


# Per-slug process_options recognised in the manifest (item 3). Values are a
# space-separated string of tokens, applied in process_image/process_all:
#   flatten                     -- see flatten_on_white above
#   model=<rembg model name>    -- passed to rembg_remover instead of DEFAULT_MODEL
#   largest-component           -- keep only the largest opaque connected
#                                   region of the cutout, dropping detached
#                                   debris (a stray logo, a prop's shadow)
#   crop=<left>,<top>,<right>,<bottom>
#                                -- a raw-pixel box applied to the source
#                                   before cutout (e.g. to remove a table
#                                   reflection attached to the bottle's base,
#                                   which largest-component can't separate)
#   locked                      -- process_all skips this slug even with
#                                   --force; the hand fix can't be reproduced
#                                   from an option, so the committed image is
#                                   left alone (see notes for why)
PROCESS_OPTION_DEFAULTS = {
    "flatten": False,
    "model": None,
    "largest_component": False,
    "crop": None,
    "locked": False,
}


def parse_process_options(value):
    options = dict(PROCESS_OPTION_DEFAULTS)
    for token in (value or "").split():
        if token == "flatten":
            options["flatten"] = True
        elif token == "largest-component":
            options["largest_component"] = True
        elif token == "locked":
            options["locked"] = True
        elif token.startswith("model="):
            options["model"] = token.split("=", 1)[1]
        elif token.startswith("crop="):
            parts = token.split("=", 1)[1].split(",")
            if len(parts) != 4:
                raise ValueError(f"crop option needs 4 comma-separated numbers, got: {token!r}")
            try:
                options["crop"] = tuple(int(part) for part in parts)
            except ValueError as exc:
                raise ValueError(f"crop option needs 4 integers, got: {token!r}") from exc
        else:
            raise ValueError(f"unknown process_options token: {token!r}")
    return options


def keep_largest_component(image):
    """Zero the alpha of every connected opaque region except the largest,
    for detached debris (a stray producer logo, a prop's shadow) that a
    cutout picked up alongside the bottle."""
    from scipy.ndimage import label

    rgba = image.convert("RGBA")
    arr = np.array(rgba)
    mask = arr[..., 3] > 0
    labeled, count = label(mask, structure=np.ones((3, 3), dtype=int))
    if count <= 1:
        return rgba
    sizes = np.bincount(labeled.ravel())
    sizes[0] = 0  # background label
    largest_label = int(sizes.argmax())
    arr[..., 3] = np.where(labeled == largest_label, arr[..., 3], 0)
    return Image.fromarray(arr, "RGBA")


def process_image(raw_path, out_path, remover, flatten=False, largest_component=False, crop=None):
    """flatten=True is for transparent sources whose alpha still carries
    artwork or a halo: they are put on white and cut out by the remover.
    crop, when given, is a raw-pixel (left, top, right, bottom) box applied
    to the source before anything else. largest_component drops every
    connected opaque region of the cutout except the largest."""
    with Image.open(raw_path) as source:
        if crop is not None:
            source = source.crop(crop)
        # rembg on an already-transparent packshot turns dark or clear glass
        # see-through, so a source with its own clean alpha is used as-is.
        rgba = source.convert("RGBA")
        if flatten:
            cutout = fill_interior_holes(remover(flatten_on_white(rgba)))
        elif has_transparent_background(source):
            # Its holes are deliberate, and the RGB under them is exporter
            # filler rather than the photo, so they are left alone.
            cutout = rgba
        else:
            cutout = fill_interior_holes(remover(rgba))
        if largest_component:
            cutout = keep_largest_component(cutout)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fit_on_canvas(cutout).save(out_path, "WEBP", quality=WEBP_QUALITY)


DEFAULT_MODEL = "isnet-general-use"


def rembg_remover(model=DEFAULT_MODEL):
    from rembg import new_session, remove

    session = new_session(model)
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


def process_all(only=None, force=False, model=DEFAULT_MODEL, flatten=False):
    manifest = read_wines_csv(MANIFEST_PATH)
    if "process_options" not in manifest.columns:
        manifest["process_options"] = ""
    removers = {}
    missing = []
    failed = []
    for slug, raw_options in zip(manifest["slug"], manifest["process_options"]):
        if only and slug != only:
            continue
        options = parse_process_options(raw_options)
        out_path = OUT_DIR / f"{slug}.webp"
        if out_path.exists():
            if not force:
                continue
            if options["locked"]:
                print(f"skipped (locked): {slug}")
                continue
        raw_path = find_raw_image(slug)
        if raw_path is None:
            missing.append(slug)
            continue
        # --model/--flatten (only meaningful with --only, see main()) override
        # the slug's own recorded options; otherwise the manifest's per-slug
        # options apply so `process --only <slug> --force` alone reproduces
        # a slug's recorded fix.
        slug_model = model if (only and model != DEFAULT_MODEL) else (options["model"] or DEFAULT_MODEL)
        slug_flatten = flatten if (only and flatten) else options["flatten"]
        remover = removers.get(slug_model)
        if remover is None:
            remover = rembg_remover(slug_model)
            removers[slug_model] = remover
        try:
            process_image(
                raw_path,
                out_path,
                remover,
                flatten=slug_flatten,
                largest_component=options["largest_component"],
                crop=options["crop"],
            )
        except Exception as exc:  # noqa: BLE001 -- one bad slug must not abort the batch
            failed.append((slug, str(exc)))
            continue
        print(f"processed {slug}")

    urls = {slug: f"/wines/{slug}.webp" for slug in manifest["slug"] if (OUT_DIR / f"{slug}.webp").exists()}
    for csv_path in (RAW_CSV, CLEANED_CSV):
        if not csv_path.exists():
            print(f"skipping {csv_path} (not found)")
            continue
        bom = has_bom(csv_path)
        write_wines_csv(set_image_urls(read_wines_csv(csv_path), urls), csv_path, bom)
    print(
        f"{len(urls)}/{len(manifest)} wines have images; "
        f"{len(missing)} without a raw file; {len(failed)} failed"
    )
    for slug in missing:
        print(f"  missing raw: {slug}")
    for slug, reason in failed:
        print(f"  failed: {slug}: {reason}")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Build and process wine bottle images.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-manifest", help="Create or refresh data/images/manifest.csv")
    process = commands.add_parser("process", help="Cut out raw images and update CSV image_url")
    process.add_argument("--only", help="Process a single slug")
    process.add_argument("--force", action="store_true", help="Reprocess even if output exists")
    process.add_argument("--model", default=DEFAULT_MODEL, help="rembg model, e.g. birefnet-general")
    process.add_argument(
        "--flatten",
        action="store_true",
        help="Put a transparent source on white and cut it out again (artwork or halo baked into its alpha)",
    )
    args = parser.parse_args(argv)
    if args.command == "init-manifest":
        init_manifest()
    else:
        if (args.flatten or args.model != DEFAULT_MODEL) and not args.only:
            process.error("--flatten and --model apply to every wine; pass --only <slug> to use them")
        process_all(only=args.only, force=args.force, model=args.model, flatten=args.flatten)


if __name__ == "__main__":
    sys.exit(main())
