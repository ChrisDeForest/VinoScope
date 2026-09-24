# Home Page Scroll Experience — Design

**Date:** 2026-09-24
**Branch:** `feature/home-scroll`
**Status:** Approved in brainstorming; awaiting written-spec review

## Goal

Replace the static home page (`frontend/src/pages/HomePage.tsx`: a heading, one CTA, four teaser
cards) with a scroll-driven showcase that tells a short wine story, teaches what each feature does,
and ends with every destination one click away. Feeling: a sommelier walking you through the
cellar — unhurried, warm, a little theatrical.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Overall direction | Hybrid: one cinematic hero, then code-driven illustrated scenes |
| Length | Medium — about 9–10 viewport heights total |
| Hero in light theme | Always-dark "cellar" band in every theme, dissolving into the page surface below |
| Scene art style | Gold line art (engraved-label look), wine as the only fill color |
| Scene layout | Alternating scenes (zig-zag); each scene plays its own mini-story when it enters view |
| Hero playback | Scroll-scrubbed: pour advances/rewinds with scroll while the hero is pinned |
| Animation tech | No library. Canvas + `requestAnimationFrame` for the hero; `IntersectionObserver` + CSS transitions for scenes; `position: sticky` for pinning |

## Assets (already produced, uncommitted)

`frontend/public/hero/` — generated with Higgsfield (Z Image keyframe → Seedance 1.5 Pro
image-to-video, 8 s, 720p), post-processed with ffmpeg (multiply mask: top fade hides a stray
bottle lip, bottom fade hides a table seam, oval vignette to black).

| Path | Contents | Size |
|---|---|---|
| `hero/desktop/frame-001.webp` … `frame-097.webp` | 1280×720, 12 fps | 1.9 MB |
| `hero/desktop/poster.webp` | copy of frame 1 | — |
| `hero/mobile/frame-001.webp` … `frame-097.webp` | 540×720 (3:4 crop around the glass) | 1.6 MB |
| `hero/mobile/poster.webp` | copy of frame 1 | — |

**Required asset change:** re-export **both** sets at 8 fps (65 frames each; mobile ≈ 1.1 MB,
desktop ≈ 1.3 MB) so the mobile set is under ~1.2 MB and both sets share one frame count
(`HERO_FRAME_COUNT = 65`). The treated source clip lives outside the repo (scratchpad); if it is unavailable,
subsample the existing mobile frames instead (keep 2 of every 3 frames, 97 → 65).

## Architecture

### Layout shell changes

`PageShell` currently wraps every route in `<main className="max-w-6xl … px-4 py-8">`. The hero
must be full-bleed with the header on top of it, so:

- `PageShell` reads `useLocation()`. When `pathname === "/"`:
  - `<main>` renders without the width/padding container (`flex-1 w-full`).
  - A "Skip to all features" link (→ `#all-features`) is rendered *before* the header, so it is
    the first focusable element on the page.
  - `<Header overlay />` is rendered.
- `HomePage` wraps everything below the hero in its own `max-w-6xl mx-auto px-4` container.
- `Header` gains an optional `overlay?: boolean` prop. When true: `absolute inset-x-0 top-0 z-20`,
  transparent background, no bottom border, and "cellar" text colors (see tokens) so it reads on the
  dark band in every theme. It is not sticky (the header is not sticky today), so it scrolls off the
  top as soon as the visitor starts scrubbing the pinned hero. Other routes are unchanged.

### Components and modules

| Unit | File | Responsibility |
|---|---|---|
| `HomePage` | `pages/HomePage.tsx` | Thin composition: skip link, `HeroPour`, five scenes, `Finale` |
| `HeroPour` | `components/home/HeroPour.tsx` | Dark full-bleed band; sticky inner stage; canvas scrubbed by scroll; headline + "Explore Wines" CTA; bottom fade into `--color-surface`; poster-only in reduced motion |
| `Scene` | `components/home/Scene.tsx` | Shared scene frame: `art` and `children` slots, `side: "left" \| "right"` (art side), `id`, `labelledBy`; adds `is-visible` on first entry into view |
| `ExploreScene` | `components/home/scenes/ExploreScene.tsx` | Glass + fanning bottles; 3 real wines via `listWines({ limit: 3 })` |
| `DiscoverScene` | `components/home/scenes/DiscoverScene.tsx` | Swirling wine; five taste meters |
| `PairScene` | `components/home/scenes/PairScene.tsx` | Plate slides in; dotted link; three food chips |
| `CompareScene` | `components/home/scenes/CompareScene.tsx` | Glass splits into two; mini radar morphs |
| `LearnScene` | `components/home/scenes/LearnScene.tsx` | Glass dissolves into vine rows + map outline with region labels |
| `Finale` | `components/home/Finale.tsx` | Closing line + five-button grid (`id="all-features"`) |
| `useScrollProgress` | `hooks/useScrollProgress.ts` | 0→1 progress of an element through its scroll range; pure math in `scrollProgress()` |
| `useInView` | `hooks/useInView.ts` | `true` once the element first intersects; fires once; returns `true` immediately when `IntersectionObserver` is unavailable |
| `usePrefersReducedMotion` | `hooks/usePrefersReducedMotion.ts` | Tracks `(prefers-reduced-motion: reduce)` via `matchMedia`, including changes |
| frame utils | `utils/frameSequence.ts` | `frameIndexForProgress`, `nearestLoadedFrame`, `frameSetForWidth`, `frameUrl`, `HERO_FRAME_COUNT` |

Scene art is inline SVG inside each scene component (no external SVG files), so strokes can use
`currentColor`/CSS variables and be animated with CSS.

### Theme tokens (`frontend/src/theme/themes.css`)

Per theme (all three blocks):

- `--color-wine-red`, `--color-wine-white`, `--color-wine-rose` — tuned per theme for contrast
  against that theme's surface (e.g. dark-burgundy red `#8e1b2e`; cream-terracotta red slightly
  deeper). Exposed to Tailwind as `wine-red`, `wine-white`, `wine-rose`.

Shared (in `:root` only, identical in every theme, because the cellar band is always dark):

- `--color-cellar-bg: #0b0506`, `--color-cellar-ink: #f3e9da`, `--color-cellar-muted: #c9b8a8`.

Line art strokes use the existing `--color-accent`.

## The experience, top to bottom

Total ≈ 9–10 viewport heights of scrolling: hero section 2.5 tall (1.5 of scrub while pinned + the
pinned screen), each scene ≈ 1.3, finale ≈ 1.

### Skip link

Rendered by `PageShell` on `/` only, before the header: "Skip to all features" → `#all-features`.
Visually hidden until focused (`sr-only focus:not-sr-only` pattern), styled with cellar colors.

### Hero (`HeroPour`)

- Outer section: `height: 250vh` (1.5 screens of scrub + the pinned screen), background
  `--color-cellar-bg`, full-bleed.
- Inner stage: `position: sticky; top: 0; height: 100vh`. Contains the canvas (covering the stage,
  `object-fit: cover` behavior computed in draw) and the copy.
- Frame placement: desktop frames are drawn `cover` (cropped to fill). Mobile frames are fitted to
  the screen width and anchored to the bottom, leaving dark cellar space above.
- Copy sits in the empty left third on desktop, and in the dark space at the top on mobile:
  `<h1>`"Find a wine you'll actually enjoy."`</h1>`, one supporting line, primary CTA
  **Explore Wines → `/explore`** (accent-filled), plus a small "Scroll" cue that fades out once
  progress > 0.05.
- Scrub: `useScrollProgress(outerRef)` → `frameIndexForProgress(p, HERO_FRAME_COUNT)` → draw.
  Redraw only when the frame index changes, at most once per animation frame.
- Frame set: `frameSetForWidth(window.innerWidth)` — `desktop` above 768px, `mobile` otherwise.
  Chosen on mount (not re-chosen on resize, to avoid re-downloading).
- Loading: poster `<img>` is visible immediately (eager; it is the first image on the page). Frames preload in
  the background after first paint (`new Image()` per frame, sequential-ish in batches of 8). The
  canvas replaces the poster once frame 1 has decoded. If the target frame isn't loaded yet, draw
  `nearestLoadedFrame(...)`.
- Bottom of the outer section: a 30vh gradient from `--color-cellar-bg` to `--color-surface`
  ("stepping out of the cellar into the tasting room").
- The media layer (poster + canvas wrapper, not the copy) has `role="img"` with
  `aria-label="Red wine being poured into a glass"`; the copy stays ordinary readable text.

### Scenes

Common behavior (in `Scene`):

- `min-height: 130vh` on desktop (`auto` with generous padding on phones), content vertically
  centered. Scenes are not pinned; the extra height is breathing room.
- Two-column grid on ≥768px; art side alternates (`left, right, left, right, left`). Single column on
  phones, art above text.
- Text column: small uppercase label (`01 · Explore`, …), `<h2>`, one or two sentences, CTA as an
  outlined accent button.
- Animation: each scene's CSS defines a *resting* (final) state by default and an *initial* state
  under `.scene-animate:not(.is-visible)`. `Scene` only adds `scene-animate` when motion is allowed,
  and `is-visible` once in view. So with JS disabled, reduced motion, or no `IntersectionObserver`,
  every scene simply renders its final state.
- Line-art draw-in: strokes use `pathLength="1"` with `stroke-dasharray: 1` and
  `stroke-dashoffset: 1 → 0` over ~1.2 s, staggered via `--delay` custom properties; scene-specific
  actions follow at ~0.8–1.6 s. Only `transform`, `opacity`, and `stroke-dashoffset` animate.

Scene specifics:

1. **Explore** (art left, wine red): glass draws in; three bottle outlines fan out behind it
   (rotate from 0 to −14°/0°/+14° around their bases). Text column shows three compact wine rows
   from `listWines({ limit: 3 })`: name, type · country, formatted price (`formatPrice`). Each row
   links to `/wines/:id`. Loading: three outline skeleton rows. Error: the rows are replaced by
   "Hundreds of wines by type, country, grape and price." — no error styling. CTA **Explore Wines →
   `/explore`**.
2. **Discover** (art right, wine red): wine surface path swirls (a transform-driven wave loop, 2
   cycles then rest); five meters fill to a sample profile — Body 70%, Tannin 55%, Acidity 60%,
   Sweetness 20%, Fruitiness 65% (the five dimensions Discover uses). CTA **Find Your Profile →
   `/discover`**.
3. **Pair** (art left, wine red): plate outline slides in beside the glass; a dotted line draws
   between them; three chips pop in with labels from `FOOD_PAIRINGS` (`steak`, `salmon`,
   `aged_cheese`). CTA **Pair With Food → `/pair`**.
4. **Compare** (art right, wine red + wine white): the glass translates apart into two glasses at
   different fill levels (red and white); a small pentagon radar between them morphs from one shape
   to another (two polygon layers cross-fading, no path morphing library). CTA **Compare Wines →
   `/compare`**.
5. **Learn** (art left, wine rosé): the glass fades out as vine rows (repeated line strokes) and a
   thin map outline draw in, with three region labels (Bordeaux, Napa, Barossa). Copy: "Grapes,
   regions, and the words behind the wine — the Learn guide is being poured now." CTA **Start
   Learning → `/learn`**.

### Finale

`id="all-features"`, `tabIndex={-1}` (focus target for the skip link). Closing line: "Your next
favorite bottle is a few clicks away." Grid of five buttons (Explore, Discover, Pair, Compare,
Learn), each with its one-line blurb from today's teasers; 5 columns desktop, 2 columns phone.

## Reduced motion and fallbacks

- `usePrefersReducedMotion()` true → `HeroPour` renders a normal-height (100vh) band with the poster
  image only (no sticky, no canvas, no frame preloading); scenes omit `scene-animate`, so they
  render final states. All copy and CTAs present.
- `IntersectionObserver` missing → `useInView` returns `true`; scenes show final states.
- Canvas 2D context unavailable → keep the poster image.
- API failure in Explore → fallback copy (above); page never shows an error state.

## Accessibility

- One `<h1>` (hero); each scene and the finale has an `<h2>` and is a `<section aria-labelledby>`.
- All CTAs are `<Link>`s with visible focus rings (`focus-visible:outline` in accent / cellar ink
  over the hero).
- Decorative SVG art is `aria-hidden="true"` and `focusable="false"`.
- Text contrast checked in all three themes; hero text uses cellar tokens on the always-dark band.

## Performance budget

- No new runtime dependencies.
- Main JS chunk (`index-*.js`) growth ≤ 15 kB gzip (currently 71.9 kB gzip; recharts is already
  split into its own lazy chunk).
- Hero frames: desktop ≤ ~2 MB, mobile ≤ ~1.2 MB; never block first paint; poster is the LCP image.
- Scroll handler: passive listener, work deferred to `requestAnimationFrame`, no layout reads other
  than one `getBoundingClientRect()` per frame on the hero section.

## Testing

Vitest + jsdom + Testing Library (existing setup; `vitest.setup.ts` only adds jest-dom + cleanup).
Browser API stubs live in the tests that need them (`vi.stubGlobal`), following
`CompareTiles.test.tsx`'s `matchMedia` stubbing.

- `utils/frameSequence.test.ts`: progress→index mapping incl. clamping at 0/1 and rounding;
  `nearestLoadedFrame` picks the closest loaded index (ties → lower) and returns `null` when none
  loaded; `frameSetForWidth` boundary at 768; `frameUrl` zero-pads to 3 digits.
- `hooks/useScrollProgress.test.ts`: pure `scrollProgress({ top, height, viewportHeight })` for
  above/inside/below viewport and zero-length ranges.
- `hooks/usePrefersReducedMotion.test.ts`: initial value and change-event updates via stubbed
  `matchMedia`.
- `hooks/useInView.test.tsx`: stubbed `IntersectionObserver` — becomes true on intersect, stays
  true, disconnects; returns true when the API is absent.
- `components/home/Scene.test.tsx`: `is-visible` added on intersect; `scene-animate` omitted under
  reduced motion; art/text order follows `side`.
- `components/home/scenes/ExploreScene.test.tsx`: skeletons while loading, three linked wines on
  success, fallback copy on rejection (mocked `listWines`).
- `pages/HomePage.test.tsx` (new; reduced motion stubbed on): renders hero `<h1>`, five scene
  headings, finale; every CTA's `href` (`/explore` ×2+, `/discover`, `/pair`, `/compare`, `/learn`);
  no `<canvas>`; poster image present.
- `components/layout/Header.test.tsx` (extend): overlay prop applies transparent/absolute classes;
  default render unchanged.
- `components/layout/PageShell.test.tsx` (new): `/` renders the skip link as the first link (targets
  `#all-features`), the overlay header, and an uncontained main; another route renders none of that.

Not unit-tested: canvas drawing and CSS animation timing (jsdom can't render them).

**Visual verification after build:** run the app; screenshot hero at progress 0 / 0.5 / 1, each
scene, and the finale — in all three themes, at 1440px and 375px, with reduced motion on and off.

**Guardrails:** full frontend suite green, `tsc -b` clean, `vite build` clean with the chunk budget
above.

## Out of scope

- Motion work on other pages (phase two; see `docs/prompts/scroll-experience-prompt-guide.md`).
- Real Learn page content.
- A light-theme-specific hero asset.
- Sound.
