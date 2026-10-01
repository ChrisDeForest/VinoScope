# Learn Page, Part 2: Vine to Glass — Design

**Date:** 2026-09-30
**Status:** Approved in brainstorming; awaiting written-spec review
**Builds on:** `2026-09-30-learn-page-framework-taste-design.md` (Part 1, merged)

## Goal

Add the second Learn chapter, **Vine to Glass**: how wine is made, told as a vertical timeline
whose gold vine grows down the page as the reader scrolls. With a second chapter, the sticky
chapter nav becomes visible for the first time, so the three nav/hash items deferred from Part 1's
final review land here.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Story format | Growing vine timeline: a spine line grows with scroll, linking 7 stages that alternate sides |
| Wine-style differences | One path, with color-coded style callouts at the stages where styles differ |
| Callout links | Each callout links to Explore filtered by that type (`/explore?type=…`) |
| Stage copy format | "What happens" + "Why it matters" (how it shows up in what you taste) |
| Content source | `content/learn/vine.ts`, every entry `source: "general"` until checked against course notes |
| Data | None — static content and SVG only |

## The story

Seven stages, in order:

| # | id | Title | What it covers | Callouts |
|---|---|---|---|---|
| 1 | `vineyard` | Vineyard | Terroir: climate, soil, sun, slope; vines take about 3 years to bear usable fruit | — |
| 2 | `harvest` | Harvest | Picking when sugar and acid balance; hand vs machine. Ties to Sweetness and Acidity | — |
| 3 | `crush` | Crush & Press | Destemming and crushing | white, rosé, red |
| 4 | `ferment` | Fermentation | Yeast turns sugar into alcohol and CO₂; stopping early leaves sweetness | red, fortified |
| 5 | `age` | Aging | Stainless steel keeps wine fresh and fruity; oak adds vanilla, spice, some tannin | — |
| 6 | `bottle` | Blending & Bottling | Blending grapes or barrels, fining and filtering, bottling | sparkling |
| 7 | `glass` | In Your Glass | Bottle aging, serving, then tasting; ends with a link to `#taste` ("Now taste it: How to Taste ↑") | — |

Callout content:

- **Crush & Press** — white: pressed right away so the juice leaves the skins; rosé: a few hours on
  the skins for a blush of color; red: the skins stay in.
- **Fermentation** — red: ferments with its skins, which give color and tannin; fortified: brandy
  is added mid-fermentation, stopping it with sugar left (Port).
- **Blending & Bottling** — sparkling: a second fermentation inside the bottle traps CO₂ as bubbles.

Callout `style` values must be real dataset types: `red`, `white`, `rosé`, `sparkling`,
`fortified` (the `type` values Explore filters on; `rosé` includes the accent).

## Layout and motion

**Timeline layout (`VineChapter`).**

- ≥768px: a central vertical spine. Each stage sits in a row with a node (small gold leaf) on the
  spine, art on one side and text on the other; sides alternate each stage (stage 1 text-left).
- Phones: the spine runs down the left edge (≈24px in); every stage stacks art above text to the
  spine's right.

**The vine grows with scroll.**

- The spine is a thin `bg-accent` bar spanning the timeline's full height over a faint
  `bg-surface-border` track, grown with `transform: scaleY(progress)` from `transform-origin: top`.
  (A straight line needs no SVG dash trick, and transform is the only animated property.) The
  transform is set directly on the element via a ref, not React state, so scrolling doesn't
  re-render the chapter.
- `progress` comes from `useScrollProgress(ref, onProgress, enabled, throughProgress)`:
  `throughProgress({ top, height, viewportHeight, anchor = 0.6 })` = how far the line at
  `anchor × viewportHeight` has travelled through the element, clamped to 0–1:
  `clamp((anchor × viewportHeight − top) / height)`.
- Each stage uses `useReveal` (Part 1): its node `pop`s and its art `draw`s in when the stage
  enters view.
- First frame: when motion is allowed the spine renders at `scaleY(0)` (undrawn), so
  there is no flash of a full vine before the first progress update; `useScrollProgress` then sets
  the real value immediately on mount.
- Resting-state rule (same as Part 1): reduced motion or no `IntersectionObserver` shows finished
  stages. Under reduced motion `useScrollProgress` is not enabled (no scroll listener) and the
  spine renders at `scaleY(1)` (fully drawn).

## Chapter nav and the Part 1 deferred items

With `LEARN_CHAPTERS = [taste, vine]`, `ChapterNav` renders "How to Taste · Vine to Glass".

1. **Hash drift.** `/learn#vine` is measured on arrival while Taste's example pairs are still
   loading; when they load (or hide), content above `#vine` changes height. Fix: the pair area in
   `DimensionBlock` is a wrapper with the same minimum height in every state (loading, ready,
   hidden), sized to the ready layout: two stacked cards on phones, side by side from `sm`. The
   hidden state keeps the reserved space empty.
2. **Active chapter with two simultaneous entries.** `useActiveChapter` currently takes the first
   intersecting entry in observation order. Fix: among intersecting entries in a batch, pick the
   one whose `boundingClientRect.top` is closest to the band's top edge (20% of viewport height).
3. **Observer while hidden.** `ChapterNav` passes no ids to `useActiveChapter` when it has fewer
   than two chapters, so no observer is created.

**Home tie-in.** The home `LearnScene` copy mentions both chapters (tasting and how wine is made).

## Units

| Unit | File | Responsibility |
|---|---|---|
| content | `content/learn/vine.ts` | `VINE_CHAPTER` (`id: "vine"`, label "Vine to Glass", title, lead, source) and `VINE_STAGES` (`id`, `title`, `what`, `why`, `callouts?: { style, text }[]`, `source`) |
| `throughProgress` | `hooks/useScrollProgress.ts` | Pure progress function described above |
| `useScrollProgress` | `hooks/useScrollProgress.ts` | Optional 4th parameter `progressFn` (defaults to `scrollProgress`; the home hero is unchanged) |
| `VineChapter` | `components/learn/vine/VineChapter.tsx` | Spine SVG + stages; wires `useScrollProgress` (disabled under reduced motion) |
| `VineStage` | `components/learn/vine/VineStage.tsx` | One stage: node, art (`aria-hidden`), number + `<h3>`, What happens / Why it matters, callouts; `useReveal` |
| `StyleCallout` | `components/learn/vine/StyleCallout.tsx` | Wine-colored chip (red / white / rosé / sparkling / fortified) with text and "Explore {style} wines →" link to `/explore?type=<encoded>` |
| art | `components/learn/vine/art/{Vineyard,Harvest,Crush,Ferment,Age,Bottle}Art.tsx`, `index.ts` | Six new SVGs; `glass` reuses `Glass` from the home art. `STAGE_ART: Record<StageId, () => JSX.Element>` |
| chapters | `components/learn/chapters.ts` | Adds `vine` after `taste` |
| nav fixes | `hooks/useActiveChapter.ts`, `components/learn/ChapterNav.tsx`, `components/learn/taste/DimensionBlock.tsx` | Items 1–3 above |
| home copy | `components/home/scenes/LearnScene.tsx` | Mentions both chapters |

Style colors: red → `wine-red`, white → `wine-white`, rosé → `wine-rose`; sparkling and fortified
have no dedicated token, so sparkling uses `wine-white` and fortified uses `wine-red`, each with
the style name always written in the chip (color is never the only signal).

## Testing

Vitest + Testing Library, test-first.

- **Content:** 7 stages in the order above with non-empty `title`/`what`/`why` and a `source`;
  every callout `style` is one of `red`, `white`, `rosé`, `sparkling`, `fortified`; ids unique.
- **`throughProgress`:** 0 while `top ≥ anchor × viewportHeight`; 1 once
  `top + height ≤ anchor × viewportHeight`; linear between; clamped.
- **`useScrollProgress`:** still defaults to `scrollProgress` (existing tests stay green); uses a
  passed `progressFn`.
- **`VineChapter`:** renders 7 `<h3>`s in order; spine `scaleY` follows the measured
  scroll position; under reduced motion the spine is at `scaleY(1)` and no scroll listener is added.
- **`VineStage`:** renders What happens / Why it matters and its callouts; art is `aria-hidden`.
- **`StyleCallout`:** link `href` is `/explore?type=ros%C3%A9` for rosé and `/explore?type=red`
  for red; chip text names the style.
- **Nav:** `LearnPage` shows the nav with "How to Taste" and "Vine to Glass" links;
  `useActiveChapter` picks the entry nearest the band when two arrive in one batch; `ChapterNav`
  creates no observer with one chapter.
- **`DimensionBlock`:** the pair wrapper carries the same min-height classes in loading, ready,
  and hidden states.
- **`LearnPage`:** `/learn#vine` scrolls the vine chapter into view on arrival.
- **Home:** `LearnScene` copy updated; old copy gone.

## Out of scope

Parts 3–5, backend changes, raster images, a forking red/white vine, and on-page source markers.
