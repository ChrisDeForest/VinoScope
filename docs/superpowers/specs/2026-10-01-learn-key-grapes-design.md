# Learn Page, Part 3: Key Grapes — Design

**Date:** 2026-10-01
**Status:** Approved in brainstorming; awaiting written-spec review
**Builds on:** Part 1 (`2026-09-30-learn-page-framework-taste-design.md`) and Part 2
(`2026-09-30-learn-vine-to-glass-design.md`), both merged.

## Goal

Add the third Learn chapter, **Key Grapes**: the seven major ("noble") grape varieties taught in
the user's course, shown as a grape picker above one detail panel, each grape with a textbook taste
profile on the site's five scales and a link into Explore with a live catalog count.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Grapes | Classic 7: Cabernet Sauvignon, Merlot, Pinot Noir, Syrah/Shiraz (reds); Chardonnay, Sauvignon Blanc, Riesling (whites) |
| Layout | Picker (tab chips, grouped Reds / Whites) + one detail panel |
| Taste profile | Textbook values in the content file (single score or a range), not catalog averages |
| Explore tie-in | Button with a live count from the same filter the link uses |
| Deep links | `#grape-<slug>` selects a grape on arrival; selecting updates the hash (replace) |
| Content source | `content/learn/grapes.ts`, every entry `source: "general"` |

## Content

Each grape: `id` (URL-safe slug), `name`, `color` (`red` \| `white`), `exploreGrape` (the Explore
`grape` filter value), `tagline` (one line), `about` (2–3 sentences, "What it's like"), `notes`
(3–5 flavor notes, "Tastes like"), `profile` (`Record<Dimension, number | [number, number]>`),
`regions` (3–4, "Where it shines"), `source`.

| id | Name | exploreGrape | Profile S · A · T · B · F | Tastes like | Where it shines |
|---|---|---|---|---|---|
| `cabernet-sauvignon` | Cabernet Sauvignon | Cabernet Sauvignon | 1 · 3 · 5 · 5 · 4 | blackcurrant, black cherry, cedar, mint | Bordeaux (Left Bank), Napa Valley, Coonawarra, Chile |
| `merlot` | Merlot | Merlot | 1 · 3 · 3 · 4 · 4 | plum, black cherry, cocoa | Bordeaux (Right Bank: Pomerol, Saint-Émilion), Washington, Napa Valley |
| `pinot-noir` | Pinot Noir | Pinot Noir | 1 · 4 · 2 · 2 · 3 | red cherry, raspberry, mushroom, earth | Burgundy, Willamette Valley, Sonoma Coast, Central Otago |
| `syrah` | Syrah / Shiraz | Syrah | 1 · 3 · 4 · 5 · 4 | blackberry, black pepper, smoked meat | Northern Rhône, Barossa Valley, Washington |
| `chardonnay` | Chardonnay | Chardonnay | 1 · 3 · 1 · 2–4 · 3 | apple, lemon (unoaked); pineapple, butter, vanilla (oaked) | Burgundy (Chablis, Meursault), California, Australia |
| `sauvignon-blanc` | Sauvignon Blanc | Sauvignon Blanc | 1 · 5 · 1 · 2 · 4 | grapefruit, green apple, cut grass, passion fruit | Loire (Sancerre), Marlborough, Bordeaux |
| `riesling` | Riesling | Riesling | 1–5 · 5 · 1 · 2 · 4 | lime, green apple, peach, honey; petrol with age | Mosel, Alsace, Clare Valley, Finger Lakes |

Order is the table order (reds, then whites). The Syrah entry's copy says it is called Shiraz in
Australia. Explore's grape filter is a case-insensitive *contains* match, so `Syrah` does not
include the dataset's "Shiraz" wines; the link and count both use `Syrah`, so they always agree.

`GRAPES_CHAPTER`: `id: "grapes"`, `label: "Key Grapes"`, `title: "Seven grapes to know"`, a lead
line, `source: "general"`.

## Picker and panel

**Picker (`GrapePicker`).** Two labeled groups, "Reds" then "Whites", forming one WAI-ARIA tabs
widget: a single `role="tablist"` (labelled "Grapes") containing all seven `role="tab"` chips in
order. The "Reds" / "Whites" group labels sit inside the row as `aria-hidden` visual labels (a
tablist may only contain tabs); the panel names the grape's color for assistive tech
("Red grape" / "White grape" under the heading). Each chip is a pill with a
dot in its wine color (`bg-wine-red` / `bg-wine-white`) and the grape name; the selected chip uses
the accent style and `aria-selected="true"`. Keyboard: ArrowRight/ArrowDown → next, ArrowLeft/
ArrowUp → previous (both wrap), Home → first, End → last; moving focus also selects (automatic
activation). Roving tabindex: only the selected chip has `tabIndex=0`. Each chip has
`id="grape-<slug>"` and `aria-controls` pointing at the panel, plus `scroll-mt-24` so a hash
scroll lands below the sticky nav. On phones the chip row scrolls horizontally.

**Panel (`GrapePanel`).** `role="tabpanel"`, `aria-labelledby` the selected chip. Desktop: art left
(1/3), text right (2/3); phones: art above text. Remounted per grape (`key={grape.id}`), so its
`useReveal` replays the art draw-in on every switch (finished immediately under reduced motion).
Text order: `<h3>` name, then "Red grape" / "White grape" and the tagline; "What it's like"; "Tastes like" as small note chips; profile
(`ProfileBars`); "Where it shines" as a comma-separated list; `GrapeExploreLink`.

**Art (`GrapeArt`).** One gold line-art cluster with a stem and vine leaf; berries filled with the
grape's wine color (`fill-wine-red` / `fill-wine-white`), popping in after the outline draws.
Uses the shared `draw` / `pop` classes (every `.draw` has `pathLength={1}`), `aria-hidden`.

**Profile (`ProfileBars`).** Five rows in `DIMENSIONS` order, titled with `DIMENSION_TITLES`.
Each row has five segments: a single score fills segments 1..score in `bg-accent`; a range
`[lo, hi]` fills lo..hi in a lighter treatment (`bg-accent` at reduced opacity via an
`opacity-50` class on those segments — the accent token supports no Tailwind opacity modifier).
Each row's accessible text: single — "Body: Full-bodied, 4 of 5"; range — "Sweetness: ranges from
Very dry to Very sweet". Segments are `aria-hidden`.

**Explore link (`GrapeExploreLink`).** Link to `/explore?grape=<encodeURIComponent(exploreGrape)>`.
On mount / grape change it calls `listWines({ grape: exploreGrape, limit: 1 })` and shows "Explore
{total} {name} wines →" once loaded; before loading or on error, "Explore {name} wines →". A
response for a previous grape is ignored. The arrow glyph is in an `aria-hidden` span.

## Deep links

- `GrapesChapter` reads the router hash once on mount: `#grape-<slug>` for a known slug selects it;
  anything else selects Cabernet Sauvignon.
- The existing `LearnPage` arrival logic already scrolls to `document.getElementById(hash)` (the
  chip) and holds it while layout settles; no change needed there.
- Selecting a grape calls `navigate({ hash: "grape-<slug>" }, { replace: true })`, which updates
  the address bar without a history entry or a scroll jump.

## Chapter nav and home

`LEARN_CHAPTERS` becomes `[taste, vine, grapes]`; the nav shows "How to Taste · Vine to Glass ·
Key Grapes". The home `LearnScene` copy adds a clause about the major grapes.

## Units

| Unit | File | Responsibility |
|---|---|---|
| content | `content/learn/grapes.ts` | `GRAPES_CHAPTER`, `GRAPES`, `GrapeContent`, `GrapeColor`, `ProfileValue` |
| `GrapesChapter` | `components/learn/grapes/GrapesChapter.tsx` | Selection state, initial hash, hash updates; renders picker + panel |
| `GrapePicker` | `components/learn/grapes/GrapePicker.tsx` | Tabs widget described above |
| `GrapePanel` | `components/learn/grapes/GrapePanel.tsx` | Tabpanel with art, copy, profile, Explore link |
| `ProfileBars` | `components/learn/grapes/ProfileBars.tsx` | Five segment rows; scores and ranges |
| `GrapeExploreLink` | `components/learn/grapes/GrapeExploreLink.tsx` | Live count + link |
| `GrapeArt` | `components/learn/grapes/GrapeArt.tsx` | Cluster SVG in the grape's color |
| chapters | `components/learn/chapters.ts` | Append `grapes` |
| home | `components/home/scenes/LearnScene.tsx` | Copy |

## Testing

Vitest + Testing Library, test-first.

- **Content:** 7 grapes in table order (4 red then 3 white); slugs unique and match
  `^[a-z0-9-]+$`; every profile value an integer 1–5, ranges `lo ≤ hi`; non-empty copy, notes,
  regions; `source` present.
- **Dataset check:** each `exploreGrape` matches (case-insensitive contains, over the `;`-separated
  `grape` column) at least 3 wines in `data/cleaned/wines_combined_200_currency_audited.csv`.
- **`ProfileBars`:** a score fills exactly that many segments; a range marks lo..hi with the range
  treatment; accessible text for both forms.
- **`GrapePicker`:** one tablist, seven tabs in order; `aria-selected` and `tabIndex` follow the
  selection; ArrowRight/Left wrap; Home/End; `onSelect` called with the right id.
- **`GrapeExploreLink`:** loading → fallback text; loaded → count text; error → fallback; `href`
  encoded (`/explore?grape=Sauvignon%20Blanc`); stale response ignored after the grape changes.
- **`GrapePanel`:** `role="tabpanel"` labelled by the tab; shows name, tagline, notes, regions;
  art `aria-hidden`.
- **`GrapesChapter`:** default Cabernet Sauvignon; `#grape-riesling` preselects Riesling; unknown
  slug → default; clicking a tab updates the location hash with `replace`.
- **`LearnPage`:** nav lists three chapters; `/learn#grape-pinot-noir` scrolls the Pinot Noir chip
  into view and selects it.
- **Home:** `LearnScene` copy mentions grapes.

## Out of scope

Parts 4–5, grapes beyond the seven, catalog-averaged profiles, food pairings, and backend changes
(including a Syrah/Shiraz alias in the grape filter).
