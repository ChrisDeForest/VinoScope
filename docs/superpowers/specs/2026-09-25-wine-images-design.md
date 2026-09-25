# Wine Images — Design

## Problem

`wines.image_url` exists end to end — model, API schemas, admin edit form,
and three render sites (`WineCard`, `WineDetailPage`, `CompareSlot`) — but
all 200 wines in `data/cleaned/wines_combined_200_currency_audited.csv`
have an empty `image_url`, so every card shows the flat dark placeholder.

Two further constraints came out of investigation:

- **Wine.com (104 wines) blocks automated access** — product pages return
  403 to both curl and WebFetch, and its image filenames are opaque hashes,
  not product IDs. Those wines must be sourced from the producer's own site.
- **The site is multi-theme** (`frontend/src/theme/themes.css`). Images with
  a baked-in background (white studio, grey gradient) would clash with dark
  themes.

## Decision

1. **Real bottle photos first, AI fallback.** For each wine, find the
   producer's bottle shot, download it, and visually verify it (label
   matches, standard bottle size — half-bottle acceptable for dessert).
   Wines with no findable photo get a FLUX.2 Pro 1k image (unlimited on the
   Higgsfield plan, `use_unlim: true`).
2. **AI fallbacks never fake a label.** Prompt for the correct bottle shape
   and wine colour for the type (Bordeaux for red/white, flute-style
   sparkling bottle, slim half-bottle for dessert, Port-style for
   fortified, clear flint for rosé), plain unprinted label, no readable
   text, on a plain white background.
3. **All images are transparent cutouts.** Background removed locally with
   `rembg` (free; one-time ~170 MB model download) so the theme's surface
   shows through. No Higgsfield `remove_background` (not on the unlimited
   list).
4. **Images are files in the repo, not hotlinks.** Hotlinked producer
   images can move, break, or be hotlink-blocked on demo day.

## Components

### Manifest — `data/images/manifest.csv`

One row per wine: `slug, winery, name, vintage, type, source, source_url,
notes`. `source` is `real` or `ai`. This is the provenance record for every
image. `data/` is gitignored, so the manifest is committed with `git add -f`
(same as the existing CSVs). Raw downloads live in `data/images/raw/<slug>.<ext>`
and are not committed.

The manifest is filled by hand-research in batches (Claude finds, downloads,
and inspects each image), not by a scraper — `og:image` heuristics proved
unreliable (e.g. Graham's `og:image` is a site header, Schloss Johannisberg
lists one image per bottle size).

### Slugs

`slugify(f"{winery} {name} {vintage or 'nv'}")` — lowercase ASCII,
accents stripped, non-alphanumerics collapsed to `-`. Stable across DB
re-imports (DB ids are not).

### Processing script — `scripts/process_wine_images.py`

For each manifest row with a raw file:

1. Remove background with `rembg`.
2. Trim to the alpha bounding box.
3. Scale to fit inside 540×860 and centre on a 600×900 transparent canvas
   (30 px / 20 px margin), preserving aspect ratio.
4. Save `frontend/public/wines/<slug>.webp` (lossy WebP, quality 85, alpha
   kept).
5. Set `image_url = /wines/<slug>.webp` for the matching row
   (winery + name + vintage) in **both** the raw and cleaned CSVs, so
   re-running `normalize_wines.py` from raw does not wipe it.

Flags: `--only <slug>` to reprocess one wine; default skips wines whose
output already exists unless `--force`.

New dependencies in `backend/requirements.txt`: `Pillow`, `rembg`.

### DB backfill

No migration. `import_wines.py` already sets `wine.image_url` on the
matched wine (winery + name + vintage), so re-running
`python scripts/import_wines.py data/cleaned/wines_combined_200_currency_audited.csv`
backfills the live DB. Admin edits remain possible afterwards.

### Frontend display

`WineCard`, `WineDetailPage`, `CompareSlot`:

- `object-cover` → `object-contain`, so tall bottles are never cropped.
- Image sits on a panel using the theme's raised-surface token with a soft
  drop shadow (`drop-shadow` filter, so the shadow follows the bottle's
  alpha outline, not the box).
- Existing dark placeholder and `onError` fallback unchanged.

## Testing

- **pytest** (`tests/scripts/test_process_wine_images.py`): slug generation
  (accents, `NV`, punctuation); processing a synthetic image on a white
  background yields a 600×900 WebP with transparent corners (rembg stubbed
  in unit tests so CI does not download the model); CSV update writes the
  right row and leaves others untouched.
- **Coverage check**: a test that every row of the cleaned CSV has a
  non-empty `image_url` whose file exists under `frontend/public/wines/`.
  Added once all 200 images are in; until then it is the progress gauge.
- **Vitest**: update `WineCard` / `CompareSlot` / `WineDetailPage` tests
  for the `object-contain` class where they assert on it.
- **Visual check**: run the app and eyeball Explore in at least one light
  and one dark theme.

## Out of scope

- Multiple images per wine, zoom/lightbox.
- Automated scraping of retailer sites.
- Image CDN or responsive `srcset` variants (600×900 WebP is small enough).
