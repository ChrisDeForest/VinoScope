# Learn Page, Part 1: Framework + How to Taste — Design

**Date:** 2026-09-30
**Status:** Approved in brainstorming; awaiting written-spec review

## Context

The Learn page (`/learn`) is currently a stub (`pages/StubPages.tsx`). It will be built in five
parts, each with its own spec → plan → build cycle:

1. **Page framework + How to Taste** (this spec)
2. Vine to Glass
3. Key Grapes
4. Glossary
5. Regions map

Content will eventually come from the user's Wines of the World course notes. Until then, all copy
is written from general wine knowledge and tagged so it can be checked against the notes later.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Page structure | One long `/learn` page with a sticky chapter nav of anchor links (not a hub of sub-pages, not tabs) |
| Unbuilt chapters | Not listed at all; no "coming soon" placeholders |
| Chapter nav with one chapter | Hidden until a second chapter exists (built and tested now) |
| How to Taste content | Per dimension: line-art illustration, explanation, 1–5 scale, and a low-vs-high pair of real wines |
| Example wine selection | Hand-picked wines in a content file, identified by winery + name + vintage (not DB ids, which are assigned at import); not chosen at runtime, no new backend endpoint |
| Content provenance | Every content entry carries `source: "general" \| "course"`; not shown on the page |
| Visual style | Reuse the home scenes' gold line art and reveal-on-scroll animation |

## Page framework

`/learn` uses the normal `PageShell` (standard header, `max-w-6xl` content width). It does not use
the home page's dark cellar hero.

Top to bottom:

1. **Intro band.** `<h1>` "Learn what's in your glass.", one or two supporting lines, and a small
   gold line-art flourish that draws in on load (skipped under reduced motion).
2. **Chapter nav** (`ChapterNav`).
   - Horizontal bar, `position: sticky; top: 0`, sticks once the visitor scrolls past the intro.
   - One anchor link per chapter (`#taste`, and later `#vine`, `#grapes`, `#glossary`, `#regions`).
   - The chapter currently on screen gets `aria-current="true"` and the accent style.
   - Clicking scrolls smoothly (instantly under reduced motion).
   - On phones it becomes a horizontally scrollable strip.
   - Renders nothing when there are fewer than two chapters. With Part 1 only, it does not appear.
3. **Chapters.** Each one is a `<section id={chapter.id} aria-labelledby=…>` with a header in the
   home scene style: small uppercase label (`01 · How to Taste`), `<h2>`, short lead paragraph.

**Single source of truth.** `LEARN_CHAPTERS` (`id`, `label`, `title`, `Component`) drives both the
nav and the sections. Adding a later part means one new array entry plus its component.

**Deep links.** Loading `/learn#taste` scrolls that chapter into view after first render.

**Stub removal.** `pages/StubPages.tsx` and `components/common/StubPage.tsx` are deleted (Learn is
their only user); `App.tsx` imports `LearnPage` from `pages/LearnPage.tsx`.

**Home tie-in.** The home `LearnScene` copy "the Learn guide is being poured now" is replaced with
copy describing what's there now (how to taste the five dimensions).

## How to Taste chapter

**Header.** Label `01 · How to Taste`, `<h2>` "Five things your mouth is measuring", and a lead
line explaining that these are the same five scales Discover and Compare use.

**Five dimension blocks**, one per entry in `DIMENSIONS` (`utils/dimensionLabels.ts`), in that
order: Sweetness, Acidity, Tannin, Body, Fruit Intensity (titles from `DIMENSION_TITLES`). Blocks
alternate art-left and art-right on ≥768px; on phones the art stacks above the text.

Each block contains:

1. **Line-art illustration** (inline SVG, gold `stroke-accent` strokes, wine color as the only
   fill). Strokes draw in, then one small action plays:
   - **Sweetness:** a grape cluster; a droplet forms and falls into a glass.
   - **Acidity:** a lemon wedge; small droplets pop out around it.
   - **Tannin:** a teacup beside a grape skin and seeds; a ripple draws across a tongue outline.
   - **Body:** three glasses (skim milk, whole milk, cream) filling to different levels.
   - **Fruit Intensity:** berries pop in one by one, from sparse to a full cluster.
2. **Text.** `<h3>` with the dimension title, then three short parts: **What it is** (1–2
   sentences), **How it feels** (where in the mouth you notice it), **Try this** (one practical
   tip, e.g. "Taste a lemon slice, then the wine").
3. **Scale** (`DimensionScale`). Five labeled steps using `DIMENSION_LABELS[dimension]`, so the
   wording matches Discover exactly. The two example wines are marked at their actual scores.
4. **Example pair.** Two `ExampleWineCard`s, low then high. Each shows the bottle photo, name,
   type · country, the score ("Tannin 1 / 5"), and a one-line reason from the content file. Each
   card links to `/wines/:id`.
   - Loading: two skeleton cards.
   - Error, or a pick with no exact match: that dimension's pair is hidden. The explanation and scale
     still render. No error styling (same quiet approach as the home Explore scene).
   - The scale's markers appear only for wines that loaded.

**Scores come from the API**, not the content file, so the page always shows a wine's real score.
The dataset currently has no wine scored 1 on acidity or fruit intensity; the "low" pick for
those is simply the lowest-scoring good example.

## Units

| Unit | File | Responsibility |
|---|---|---|
| `LearnPage` | `pages/LearnPage.tsx` | Composition: intro, `ChapterNav`, chapter sections; handles the initial `#hash` scroll |
| `LEARN_CHAPTERS` | `components/learn/chapters.ts` | Chapter list driving nav and sections |
| `ChapterNav` | `components/learn/ChapterNav.tsx` | Sticky anchor bar with active-chapter highlight; `null` for < 2 chapters |
| `useActiveChapter` | `hooks/useActiveChapter.ts` | Given chapter ids, returns the id currently on screen (IntersectionObserver); returns the first id when `IntersectionObserver` is unavailable |
| `useReveal` | `hooks/useReveal.ts` | Extracted from `Scene`: combines `useInView` (400 ms delay, fires once) and `usePrefersReducedMotion`; returns the class list (`scene-animate`, `is-visible`) |
| `Scene` | `components/home/Scene.tsx` | Unchanged behavior; now uses `useReveal` |
| `TasteChapter` | `components/learn/taste/TasteChapter.tsx` | Chapter header and five blocks; loads all example wines |
| `DimensionBlock` | `components/learn/taste/DimensionBlock.tsx` | One dimension: art, text, scale, pair; uses `useReveal` |
| `DimensionScale` | `components/learn/taste/DimensionScale.tsx` | 1–5 steps with example markers |
| `ExampleWineCard` | `components/learn/taste/ExampleWineCard.tsx` | Compact linked wine card and its skeleton |
| art | `components/learn/taste/art/{Sweetness,Acidity,Tannin,Body,Fruit}Art.tsx` | Five SVGs; reuse `Glass` and `cssVars` from `components/home/art` |
| content | `content/learn/taste.ts` | Per-dimension copy, tip, example picks (`{ winery, name, vintage, reason }` for low and high), `source` |

**Shared animation CSS.** The reveal classes used by both home scenes and Learn blocks (`.draw`,
`.pop`, `.slide`, `.meter-fill`, `.fade-out` and their `.scene-animate:not(.is-visible)` initial
states) stay in `components/home/home.css`. `DimensionBlock` adds the `scene` class and imports
that stylesheet. Learn-only art actions (droplet fall, berry pop order, milk fills) go in
`components/learn/learn.css`, following the same rule: every rule outside
`.scene-animate:not(.is-visible)` is the finished look, so reduced motion, no JS, and no
`IntersectionObserver` all show complete art.

## Data flow

- Picks are identified by the importer's natural key (winery + name + vintage), because
  database ids are assigned at import time and can change on a re-import.
- `TasteChapter` resolves the 10 picks in parallel with `listWines({ q: name, limit: 10 })` and
  keeps the item whose `winery` and `vintage` match exactly (`null` vintage for NV). List items
  already carry the five scores, image, type and country, so no detail fetch is needed. It uses
  `Promise.allSettled`, so each wine succeeds or fails on its own; no exact match counts as a
  failure.
- It passes each `DimensionBlock` a status for its pair: `loading`, `ready` (both wines), or
  `hidden` (either wine failed).
- No new API endpoints or backend changes.

## Content

- All copy lives in `content/learn/taste.ts`, not in components.
- Each dimension entry has `source: "general"` for now. When the course notes arrive, verified or
  replaced entries become `"course"`, and course terminology wins over general phrasing.
- Example pairs are chosen during planning from `data/cleaned/wines_combined_200_currency_audited.csv`
  as clear teaching contrasts (e.g. a bone-dry sparkling vs a dessert wine for sweetness). The
  user plans to add wines to even out the dataset; pairs can be swapped by editing the content
  file.

## Testing

Vitest + Testing Library, test-first.

- **Content:** every dimension in `DIMENSIONS` has copy (what, feel, tip) and a low/high pair.
- **Dataset check:** reads the cleaned CSV and asserts every pick's winery + name + vintage
  exists and that the high pick's score beats the low pick's by at least 2.
- **`ChapterNav`:** renders nothing with one chapter; with two or more, renders anchor links and
  sets `aria-current` on the active one.
- **`useActiveChapter`:** with a stubbed `IntersectionObserver`, reports the intersecting chapter;
  falls back to the first id without one.
- **`useReveal`:** adds `scene-animate` only when motion is allowed and `is-visible` once in view.
- **`TasteChapter`:** resolves a pick only on an exact winery + vintage match; a non-match or
  failed request hides that dimension's pair only.
- **`DimensionBlock`:** scale labels match `DIMENSION_LABELS`; cards link to `/wines/:id` and show
  API scores; skeletons while loading; pair hidden (text and scale still present) on error.
- **`LearnPage`:** renders the intro and the How to Taste chapter; `/learn#taste` scrolls to it.
- **Regressions:** existing `Scene` and home tests stay green after the `useReveal` switch;
  `App` routing test still reaches `/learn`.

## Out of scope

Chapters 2–5, backend changes, new raster images, and any on-page indicator of content source.
