# Wine Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 200 wines a transparent-background bottle image that sits on the active theme's surface.

**Architecture:** A manifest (`data/images/manifest.csv`) records one source image per wine (real producer photo, or FLUX.2 Pro 1k fallback). `scripts/process_wine_images.py` cuts each raw image out with `rembg`, fits it on a 600×900 transparent canvas, writes `frontend/public/wines/<slug>.webp`, and writes `/wines/<slug>.webp` into the `image_url` column of the raw and cleaned CSVs. Re-running the existing importer backfills the DB. A shared `WineImage` React component renders the bottle `object-contain` on a `bg-surface-raised` panel.

**Tech Stack:** Python 3.12, pandas, Pillow, rembg (CPU/onnxruntime), pytest; React + TypeScript + Tailwind, Vitest + Testing Library; Higgsfield `generate_image` (FLUX.2 Pro 1k).

**Spec:** `docs/superpowers/specs/2026-09-25-wine-images-design.md`

## Global Constraints

- Output canvas: 600×900 px, transparent; bottle scaled to fit inside 540×860, centred.
- Output format: WebP, `quality=85`, alpha preserved. Path `frontend/public/wines/<slug>.webp`; `image_url` value `/wines/<slug>.webp`.
- Slug: `slugify(f"{winery} {name} {vintage or 'nv'}")` — lowercase ASCII, accents stripped, runs of non-alphanumerics → `-`, trimmed. Raw CSV uses `NV`, cleaned CSV uses blank — both mean no vintage.
- Raw CSV `data/raw/wines_combined_200_currency_audited.csv` is UTF-8 **with BOM**; cleaned CSV is UTF-8 without BOM. Preserve each file's BOM state on write. Read with `dtype=str, keep_default_na=False`.
- `data/` is gitignored: commit only `data/images/manifest.csv` (with `git add -f`). The raw and cleaned wine CSVs stay untracked (user decision) — `process` updates them on disk only. Never commit `data/images/raw/`.
- Higgsfield: only FLUX.2 Pro at 1k (`use_unlim: true`) or Seedream 5.0 Lite may be used without asking. Any other model, upscale, edit or `remove_background` needs the user's explicit OK with a cost quote first.
- AI images must have **no readable text** on the label.
- Run Python tests from repo root with `./.venv/Scripts/python -m pytest`; frontend tests with `npm test` in `frontend/`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

- Create `scripts/process_wine_images.py` — slugs, manifest building, cutout + canvas fitting, CSV `image_url` updates, CLI (`init-manifest`, `process`).
- Create `tests/scripts/test_process_wine_images.py` — unit tests (rembg stubbed).
- Create `tests/scripts/test_wine_image_coverage.py` — every wine has an image file (added last).
- Modify `backend/requirements.txt` — add `Pillow`, `rembg[cpu]`.
- Create `frontend/src/components/wine/WineImage.tsx` + `WineImage.test.tsx` — the one place that renders a wine image and its placeholder.
- Modify `frontend/src/components/wine/WineCard.tsx`, `frontend/src/pages/WineDetailPage.tsx`, `frontend/src/components/compare/CompareSlot.tsx` — use `WineImage`, delete their three copies of `PLACEHOLDER_IMAGE`.
- Data (generated): `data/images/manifest.csv`, `data/images/raw/<slug>.<ext>` (uncommitted), `frontend/public/wines/<slug>.webp`.

---

### Task 1: Slugs, manifest and CSV helpers

**Files:**
- Create: `scripts/process_wine_images.py`
- Create: `tests/scripts/test_process_wine_images.py`
- Modify: `backend/requirements.txt`

**Interfaces:**
- Produces (used by Tasks 2, 5, 6, 7):
  - `slugify(text: str) -> str`
  - `wine_slug(winery: str, name: str, vintage: str) -> str`
  - `read_wines_csv(path: Path) -> pd.DataFrame`
  - `write_wines_csv(df: pd.DataFrame, path: Path, bom: bool) -> None`
  - `has_bom(path: Path) -> bool`
  - `build_manifest(wines: pd.DataFrame, existing: pd.DataFrame | None = None) -> pd.DataFrame` with columns `MANIFEST_COLUMNS`
  - `set_image_urls(wines: pd.DataFrame, urls: dict[str, str]) -> pd.DataFrame`
  - Constants `ROOT, CLEANED_CSV, RAW_CSV, MANIFEST_PATH, RAW_DIR, OUT_DIR, MANIFEST_COLUMNS`

- [ ] **Step 1: Add dependencies and install**

Append to `backend/requirements.txt`:

```
Pillow>=10.4
rembg[cpu]>=2.0.57
```

Run: `./.venv/Scripts/python -m pip install "Pillow>=10.4" "rembg[cpu]>=2.0.57"`
Expected: installs successfully. `./.venv/Scripts/python -c "import PIL, rembg; print('ok')"` prints `ok`.

- [ ] **Step 2: Write the failing tests**

Create `tests/scripts/test_process_wine_images.py`:

```python
import pandas as pd

from scripts.process_wine_images import (
    MANIFEST_COLUMNS,
    build_manifest,
    has_bom,
    read_wines_csv,
    set_image_urls,
    slugify,
    wine_slug,
    write_wines_csv,
)


def _wines(rows):
    return pd.DataFrame(rows, columns=["name", "winery", "vintage", "type", "image_url"])


def test_slugify_strips_accents_and_punctuation():
    assert slugify("Château d'Yquem") == "chateau-d-yquem"
    assert slugify("[yellow tail]  Shiraz!") == "yellow-tail-shiraz"
    assert slugify("Dönnhoff Riesling Spätlese") == "donnhoff-riesling-spatlese"


def test_wine_slug_uses_nv_for_blank_or_nv_vintage():
    assert wine_slug("Caymus Vineyards", "Caymus Napa Valley Cabernet Sauvignon", "2023") == (
        "caymus-vineyards-caymus-napa-valley-cabernet-sauvignon-2023"
    )
    assert wine_slug("Graham's", "Six Grapes Reserve Port", "") == "graham-s-six-grapes-reserve-port-nv"
    assert wine_slug("Graham's", "Six Grapes Reserve Port", "NV") == "graham-s-six-grapes-reserve-port-nv"


def test_build_manifest_has_one_row_per_wine_with_blank_source():
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""], ["Six Grapes", "Graham's", "", "fortified", ""]])
    manifest = build_manifest(wines)
    assert list(manifest.columns) == MANIFEST_COLUMNS
    assert list(manifest["slug"]) == ["stag-s-leap-artemis-2021", "graham-s-six-grapes-nv"]
    assert list(manifest["source"]) == ["", ""]


def test_build_manifest_keeps_existing_research():
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""]])
    existing = pd.DataFrame(
        [["stag-s-leap-artemis-2021", "Stag's Leap", "Artemis", "2021", "red", "real", "https://x/y.png", "front label"]],
        columns=MANIFEST_COLUMNS,
    )
    manifest = build_manifest(wines, existing)
    row = manifest.iloc[0]
    assert (row["source"], row["source_url"], row["notes"]) == ("real", "https://x/y.png", "front label")


def test_set_image_urls_only_touches_matching_rows():
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""], ["Six Grapes", "Graham's", "NV", "fortified", ""]])
    updated = set_image_urls(wines, {"graham-s-six-grapes-nv": "/wines/graham-s-six-grapes-nv.webp"})
    assert list(updated["image_url"]) == ["", "/wines/graham-s-six-grapes-nv.webp"]
    assert list(wines["image_url"]) == ["", ""]


def test_csv_round_trip_preserves_bom_state_and_blanks(tmp_path):
    bom_path = tmp_path / "raw.csv"
    bom_path.write_bytes("﻿name,winery,vintage,type,image_url\nSix Grapes,Graham's,NV,fortified,\n".encode("utf-8"))
    plain_path = tmp_path / "cleaned.csv"
    plain_path.write_text("name,winery,vintage,type,image_url\nSix Grapes,Graham's,,fortified,\n", encoding="utf-8")

    for path in (bom_path, plain_path):
        bom = has_bom(path)
        df = read_wines_csv(path)
        assert list(df.columns)[0] == "name"
        assert df.loc[0, "image_url"] == ""
        write_wines_csv(df, path, bom)
        assert has_bom(path) is bom

    assert has_bom(bom_path) is True
    assert has_bom(plain_path) is False
    assert read_wines_csv(plain_path).loc[0, "vintage"] == ""
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `./.venv/Scripts/python -m pytest tests/scripts/test_process_wine_images.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.process_wine_images'`

- [ ] **Step 4: Write the implementation**

Create `scripts/process_wine_images.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/Scripts/python -m pytest tests/scripts/test_process_wine_images.py -v`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt scripts/process_wine_images.py tests/scripts/test_process_wine_images.py
git commit -m "feat: wine image slugs, manifest and CSV helpers"
```

---

### Task 2: Cutout, canvas fitting and CLI

**Files:**
- Modify: `scripts/process_wine_images.py`
- Modify: `tests/scripts/test_process_wine_images.py`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces (used by Tasks 5–7):
  - `fit_on_canvas(image: PIL.Image.Image) -> PIL.Image.Image` (600×900 RGBA)
  - `process_image(raw_path: Path, out_path: Path, remover: Callable[[Image], Image]) -> None`
  - `rembg_remover() -> Callable[[Image], Image]`
  - CLI: `python -m scripts.process_wine_images init-manifest` and `python -m scripts.process_wine_images process [--only SLUG] [--force]`

- [ ] **Step 1: Write the failing tests**

Append to `tests/scripts/test_process_wine_images.py`:

```python
from PIL import Image

from scripts.process_wine_images import CANVAS_SIZE, fit_on_canvas, process_image


def _bottle_on_transparent():
    image = Image.new("RGBA", (100, 300), (0, 0, 0, 0))
    image.paste((150, 20, 40, 255), (25, 50, 75, 250))  # 50x200 opaque "bottle"
    return image


def _white_to_transparent(image):
    rgba = image.convert("RGBA")
    rgba.putdata([(r, g, b, 0) if (r, g, b) == (255, 255, 255) else (r, g, b, a) for r, g, b, a in rgba.getdata()])
    return rgba


def test_fit_on_canvas_centres_and_scales_bottle_to_height_limit():
    result = fit_on_canvas(_bottle_on_transparent())
    assert result.size == CANVAS_SIZE == (600, 900)
    assert result.mode == "RGBA"
    # scale = min(540/50, 860/200) = 4.3 -> 215x860, centred
    assert result.getchannel("A").getbbox() == (192, 20, 407, 880)
    assert result.getpixel((0, 0))[3] == 0
    assert result.getpixel((300, 450))[3] == 255


def test_fit_on_canvas_rejects_fully_transparent_image():
    import pytest

    with pytest.raises(ValueError, match="transparent"):
        fit_on_canvas(Image.new("RGBA", (10, 10), (0, 0, 0, 0)))


def test_process_image_writes_transparent_webp(tmp_path):
    raw = tmp_path / "bottle.jpg"
    source = Image.new("RGB", (200, 400), (255, 255, 255))
    source.paste((90, 10, 30), (70, 40, 130, 360))
    source.save(raw, "PNG")  # PNG content keeps pure white exact for the stub remover
    out = tmp_path / "out" / "bottle.webp"

    process_image(raw, out, _white_to_transparent)

    with Image.open(out) as written:
        assert written.format == "WEBP"
        assert written.size == (600, 900)
        assert written.mode == "RGBA"
        assert written.getpixel((5, 5))[3] == 0
        assert written.getpixel((300, 450))[3] == 255
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/Scripts/python -m pytest tests/scripts/test_process_wine_images.py -v`
Expected: FAIL with `ImportError: cannot import name 'CANVAS_SIZE'`

- [ ] **Step 3: Write the implementation**

In `scripts/process_wine_images.py`, add imports at the top (merge with existing):

```python
import argparse
import sys

from PIL import Image
```

Add below `UTF8_BOM`:

```python
CANVAS_SIZE = (600, 900)
MAX_BOTTLE_SIZE = (540, 860)
WEBP_QUALITY = 85
```

Append:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./.venv/Scripts/python -m pytest tests/scripts/test_process_wine_images.py -v`
Expected: 9 passed.

- [ ] **Step 5: Smoke-test the CLI on real data**

Run: `./.venv/Scripts/python -m scripts.process_wine_images init-manifest`
Expected: `Wrote 200 rows to ...data\images\manifest.csv`. Check `slug` is unique:
`./.venv/Scripts/python -c "import pandas as pd; m=pd.read_csv('data/images/manifest.csv', dtype=str); print(m.slug.is_unique, len(m))"` → `True 200`.

Run: `git diff --stat data/` → expect no changes to the CSVs yet.

- [ ] **Step 6: Commit**

```bash
git add scripts/process_wine_images.py tests/scripts/test_process_wine_images.py
git add -f data/images/manifest.csv
git commit -m "feat: wine image cutout pipeline and manifest"
```

---

### Task 3: Shared `WineImage` component

**Files:**
- Create: `frontend/src/components/wine/WineImage.tsx`
- Create: `frontend/src/components/wine/WineImage.test.tsx`
- Modify: `frontend/src/components/wine/WineCard.tsx:6-7,30-43`
- Modify: `frontend/src/pages/WineDetailPage.tsx:16-17,64-68`
- Modify: `frontend/src/components/compare/CompareSlot.tsx:4-5,18-22`

**Interfaces:**
- Produces: `WineImage({ src, alt, className, eager }: { src: string | null; alt: string; className?: string; eager?: boolean })`. `className` sizes the panel (e.g. `"w-full h-48"`).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/wine/WineImage.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WineImage } from "./WineImage";

describe("WineImage", () => {
  it("shows the bottle uncropped on a themed panel", () => {
    render(<WineImage src="/wines/caymus.webp" alt="Caymus" className="w-full h-48" />);
    const img = screen.getByRole("img", { name: "Caymus" });
    expect(img.getAttribute("src")).toBe("/wines/caymus.webp");
    expect(img.className).toContain("object-contain");
    expect(img.parentElement?.className).toContain("bg-surface-raised");
    expect(img.parentElement?.className).toContain("h-48");
  });

  it("uses a placeholder when there is no image", () => {
    render(<WineImage src={null} alt="Caymus" />);
    expect(screen.getByRole("img").getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("swaps a broken image for the placeholder", () => {
    render(<WineImage src="/wines/missing.webp" alt="Caymus" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img").getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("loads lazily unless eager", () => {
    const { rerender } = render(<WineImage src="/wines/a.webp" alt="A" />);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("lazy");
    rerender(<WineImage src="/wines/a.webp" alt="A" eager />);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("eager");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `frontend/`): `npm test -- src/components/wine/WineImage.test.tsx`
Expected: FAIL — cannot resolve `./WineImage`.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/wine/WineImage.tsx`:

```tsx
import { useState } from "react";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='520'%3E%3Crect width='400' height='520' fill='%232f1b1e'/%3E%3C/svg%3E";

export function WineImage({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showBottle = src !== null && !failed;

  return (
    <div className={`bg-surface-raised overflow-hidden ${className}`}>
      <img
        src={showBottle ? src : PLACEHOLDER_IMAGE}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={600}
        height={900}
        onError={() => setFailed(true)}
        className={
          showBottle
            ? "w-full h-full object-contain p-3 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]"
            : "w-full h-full object-cover"
        }
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/wine/WineImage.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Use it in the three render sites**

`frontend/src/components/wine/WineCard.tsx` — delete the `PLACEHOLDER_IMAGE` constant (lines 6-7), add `import { WineImage } from "./WineImage";`, and replace the `<img ... />` element inside `<div className="relative">` with:

```tsx
        <WineImage src={wine.image_url} alt={wine.name} eager={eagerImage} className="w-full h-48" />
```

`frontend/src/pages/WineDetailPage.tsx` — delete its `PLACEHOLDER_IMAGE` constant (lines 16-17), add `import { WineImage } from "../components/wine/WineImage";`, and replace the `<img ... />` at the top of the returned layout with:

```tsx
      <WineImage src={wine.image_url} alt={wine.name} eager className="w-full md:w-80 h-96 rounded shrink-0" />
```

`frontend/src/components/compare/CompareSlot.tsx` — delete its `PLACEHOLDER_IMAGE` constant (lines 4-5), add `import { WineImage } from "../wine/WineImage";`, and replace the `<img ... />` with:

```tsx
      <WineImage src={wine.image_url} alt={wine.name} className="w-full h-32" />
```

- [ ] **Step 6: Run the full frontend suite and build**

Run: `npm test` then `npm run build`
Expected: all tests pass (existing WineCard/CompareSlot placeholder tests still pass — they assert on `data:image/svg+xml` and on `fireEvent.error`), build clean. If a test grabbed the image with `getByRole("img")` and now finds more than one, narrow it with `{ name: <wine name> }`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/wine/WineImage.tsx frontend/src/components/wine/WineImage.test.tsx frontend/src/components/wine/WineCard.tsx frontend/src/pages/WineDetailPage.tsx frontend/src/components/compare/CompareSlot.tsx
git commit -m "feat: shared WineImage renders bottles uncropped on the theme surface"
```

---

### Task 4: Pilot — five real wines end to end

Prove the pipeline on real photos before bulk sourcing.

**Files:**
- Modify: `data/images/manifest.csv` (5 rows)
- Create: `data/images/raw/<slug>.<ext>` ×5 (not committed)
- Create: `frontend/public/wines/<slug>.webp` ×5
- Modify: raw + cleaned CSVs (`image_url` for 5 rows)

**Interfaces:**
- Consumes: Task 2 CLI; Task 3 rendering.

- [ ] **Step 1: Pick the pilot wines**

Pilot slugs (varied sources and backgrounds): the Caymus Napa Valley Cabernet (row 1), Graham's Six Grapes, one Schloss Johannisberg wine, Château d'Yquem, and one sparkling wine. Look their slugs up in `data/images/manifest.csv`.

- [ ] **Step 2: Source each image (the per-wine procedure used in Task 5)**

For each wine:
1. Find the producer's product page — start from the manifest `name`/`winery`; use WebSearch `"<winery> <name>" bottle` if needed. Wine.com pages return 403; don't use them.
2. Pick the main **front-on bottle shot** (not a header, lifestyle shot, or magnum/3 L size; half-bottle is fine for dessert). Prefer ≥ 500 px tall on a plain background.
3. Download: `curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36" -o "data/images/raw/<slug>.<ext>" "<image url>"`
4. **Look at it** with the Read tool. Confirm the label matches the wine (producer and cuvée; vintage may differ — note it).
5. Fill the manifest row: `source=real`, `source_url=<image url>`, `notes` (e.g. `label shows 2021 vintage`).

- [ ] **Step 3: Process and inspect**

Run: `./.venv/Scripts/python -m scripts.process_wine_images process`
Expected: `processed <slug>` ×5 (first run downloads the rembg model, ~170 MB), then `5/200 wines have images; 195 without a raw file`.

Read each `frontend/public/wines/<slug>.webp`. Check: whole bottle kept (no clipped neck/capsule), background gone, no halo. If a cutout is bad, try a different source photo and rerun with `--only <slug> --force`.

Run: `git diff --word-diff data/raw data/cleaned` → the only changes are the 5 new `image_url` values. If pandas rewrote anything else (quoting, line endings, number formats), fix `write_wines_csv` so the round trip leaves other rows byte-identical before continuing.

- [ ] **Step 4: Check in the app**

Backfill: `./.venv/Scripts/python scripts/import_wines.py data/cleaned/wines_combined_200_currency_audited.csv` (needs the Postgres container up and `DATABASE_URL` from `.env`). Start the app (use the `run` skill), open Explore, and search for the pilot wines. Check one light and one dark theme: bottle uncropped, no white box, shadow follows the bottle.

**Stop and show the user screenshots of the pilot before bulk sourcing.**

- [ ] **Step 5: Commit**

```bash
git add frontend/public/wines
git add -f data/images/manifest.csv
git commit -m "feat: pilot wine images for five wines"
```

---

### Task 5: Source real photos for all remaining wines

**Files:**
- Modify: `data/images/manifest.csv`
- Create: `data/images/raw/<slug>.<ext>`
- Create: `frontend/public/wines/<slug>.webp`
- Modify: raw + cleaned CSVs

**Interfaces:**
- Consumes: Task 4 Step 2 per-wine procedure; Task 2 CLI.

- [ ] **Step 1: Work in batches of ~25 manifest rows with blank `source`**, in manifest order. Apply the Task 4 Step 2 procedure to each wine. Limit research to about two searches plus the producer site per wine; if no acceptable bottle shot turns up, set `source=ai` and `notes=no real photo found: <reason>` and move on.

- [ ] **Step 2: After each batch**, run `./.venv/Scripts/python -m scripts.process_wine_images process`, Read every new `.webp` in the batch, and fix bad cutouts (`--only <slug> --force` with a better source photo, or mark `source=ai`).

- [ ] **Step 3: Commit after each batch**

```bash
git add frontend/public/wines
git add -f data/images/manifest.csv
git commit -m "feat: wine images batch <n>"
```

- [ ] **Step 4: When all batches are done**, report counts: `real` vs `ai` rows in the manifest.

---

### Task 6: AI fallback bottles

**Files:**
- Modify: `data/images/manifest.csv`
- Create: `data/images/raw/<slug>.png` for every `source=ai` row
- Create: `frontend/public/wines/<slug>.webp`
- Modify: raw + cleaned CSVs

**Interfaces:**
- Consumes: Task 2 CLI; Higgsfield `generate_image` / `generate_image_batch` (load with ToolSearch `select:mcp__claude_ai_Higgsfield__generate_image_batch,mcp__claude_ai_Higgsfield__jobs_wait,mcp__claude_ai_Higgsfield__show_generation_by_ids`).

- [ ] **Step 1: Confirm the model before generating**

Use FLUX.2 Pro (`flux_2`, variant `pro`, resolution `1k`) with `use_unlim: true`, portrait `2:3`. If that model or unlimited mode is not available as described, **stop and ask the user** — do not substitute another model.

- [ ] **Step 2: Generate one image per `source=ai` wine** with the prompt for its `type`, so bottles look the same within a type:

Common suffix for every prompt: `, centered, front view, entire bottle visible with space around it, pure white seamless background, soft even studio lighting, product photography, plain blank label with no text, no letters, no writing, no logos`

| type | prompt prefix |
|---|---|
| red | `A single 750ml Bordeaux-style wine bottle of dark green glass holding deep red wine, cream paper label, dark red foil capsule` |
| white | `A single 750ml Burgundy-style wine bottle of pale green glass holding pale golden white wine, ivory paper label, gold foil capsule` |
| rosé | `A single 750ml clear flint glass wine bottle holding pale salmon-pink rosé wine, white paper label, silver screw cap` |
| sparkling | `A single 750ml heavy dark green sparkling wine bottle with gold foil over the cork and wire cage, cream paper label` |
| dessert | `A single slim 375ml half-bottle of clear glass holding deep amber-gold sweet wine, cream paper label, gold foil capsule` |
| fortified | `A single 750ml squat dark green Port-style bottle with a bar-top cork stopper, holding dark ruby fortified wine, parchment paper label` |

Use `generate_image_batch` for groups, then `jobs_wait`, then one `show_generation_by_ids`.

- [ ] **Step 3: Download, inspect and record**

Download each result to `data/images/raw/<slug>.png`. Read it: reject and regenerate any image with legible text, clipped bottle, or wrong colour for the type. Fill manifest: `source=ai`, `source_url=<higgsfield result url>`, `notes=flux_2 pro 1k, <type> prompt`.

- [ ] **Step 4: Process, inspect, commit**

Run: `./.venv/Scripts/python -m scripts.process_wine_images process` and Read the new `.webp` files.

```bash
git add frontend/public/wines
git add -f data/images/manifest.csv
git commit -m "feat: AI fallback bottle images"
```

---

### Task 7: Coverage gate, DB backfill, final check

**Files:**
- Create: `tests/scripts/test_wine_image_coverage.py`

**Interfaces:**
- Consumes: `CLEANED_CSV`, `ROOT`, `read_wines_csv` from Task 1.

- [ ] **Step 1: Write the coverage test**

```python
from scripts.process_wine_images import CLEANED_CSV, ROOT, read_wines_csv

PUBLIC_DIR = ROOT / "frontend" / "public"


def test_every_wine_has_an_image_file():
    wines = read_wines_csv(CLEANED_CSV)
    missing = [
        f"{row['winery']} — {row['name']}"
        for _, row in wines.iterrows()
        if not row["image_url"] or not (PUBLIC_DIR / row["image_url"].lstrip("/")).is_file()
    ]
    assert missing == [], f"{len(missing)} wines without images: {missing[:10]}"
```

- [ ] **Step 2: Run it**

Run: `./.venv/Scripts/python -m pytest tests/scripts/test_wine_image_coverage.py -v`
Expected: PASS. If it fails, go back to Task 5/6 for the listed wines.

- [ ] **Step 3: Backfill the DB and run everything**

Run: `./.venv/Scripts/python scripts/import_wines.py data/cleaned/wines_combined_200_currency_audited.csv`
Run: `./.venv/Scripts/python -m pytest` → all pass.
Run (in `frontend/`): `npm test` and `npm run build` → all pass, build clean.
Check size: `du -sh frontend/public/wines` — expect roughly 5–15 MB total.

- [ ] **Step 4: Visual check**

Start the app. Check Explore (scroll through the whole list), a wine detail page and Compare with 3 wines, in one light and one dark theme. Spot-check that AI bottles and real bottles sit comparably on the page.

- [ ] **Step 5: Commit**

```bash
git add tests/scripts/test_wine_image_coverage.py
git commit -m "test: require an image for every wine"
```
