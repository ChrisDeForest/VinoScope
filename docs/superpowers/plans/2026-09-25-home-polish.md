# Home Page Polish Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD (failing test first, then code). Per this project's review cadence there are no per-task reviews; one final whole-branch review runs after Task 4.

**Goal:** Ten follow-ups to the scroll-driven home page (`docs/superpowers/specs/2026-09-24-home-scroll-experience-design.md`), grouped into four tasks.

**Tech Stack:** React 18, React Router 6, TypeScript strict (`noUnusedLocals`/`noUnusedParameters`), Tailwind 3.4, Vitest 2 + jsdom + Testing Library, ffmpeg.

## Global Constraints

- No new runtime dependencies. Main JS chunk (`index-*.js`) stays ≤ 86.9 kB gzip (currently 76.94).
- Every existing behavior not named here stays as is; existing tests keep passing (update a test only where a task changes the behavior it asserts, and say so in the report).
- Only `transform`, `opacity`, `stroke-dashoffset` (and the header's background/border colors, Task 2) may transition; wrap new transitions in Tailwind `motion-safe:`.
- All three themes (`dark-burgundy`, `cream-terracotta`, `charcoal-gold`) must look right; the hero/cellar band stays theme-independent (`cellar-*` tokens).
- Test files are type-checked by `npx tsc -b`. Before each commit: focused tests → `npx vitest run` → `npx tsc -b` (from `frontend/`).
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work directly on `master` (one or more commits per task).

---

### Task 1: Hero media behavior (items 1, 2, 3, 8, 9)

**Files:** `frontend/src/utils/frameSequence.ts` (+test), `frontend/src/components/home/HeroPour.tsx` (+test), new `frontend/src/utils/connection.ts` (+test), `frontend/scripts/build-hero-frames.sh`, `frontend/public/hero/*/still.webp`, spec doc.

1. **Full-glass still (item 1).** Add `stillUrl(set: FrameSet): string` → `/hero/${set}/still.webp`. Each set gets `still.webp` = a copy of its **last** frame (`frame-064.webp` today). Create them now with `cp`, and make `build-hero-frames.sh` write `still.webp` from the last exported frame of every set. The *static* hero (see 3) shows the still; the motion hero keeps `poster.webp` (frame 1) as its loading placeholder under the canvas.
2. **`svh` (item 2).** Replace `h-screen` on the sticky stage and on the static hero section with `h-[100svh]`.
3. **Data saver (item 3).** New `utils/connection.ts` exporting `prefersLightweightMedia(): boolean` — true when `navigator.connection?.saveData === true` or `navigator.connection?.effectiveType` is `"slow-2g"`, `"2g"`, or `"3g"`; false when `navigator.connection` is absent. Read once at mount (`useState` initializer). HeroPour renders the **static** variant when `reducedMotion || lightweight`: 100svh band, still image, no canvas, no sticky pin, no frame preloading, cue hidden. (Rename internal naming from "reduced motion branch" to "static branch" where it helps readability.) The media layer keeps `role="img"` + `aria-label="Red wine being poured into a glass"`.
4. **Shorter pour (item 8).** Motion hero section height `h-[250vh]` → `h-[200vh]` (one screen of scrub while pinned).
5. **Landscape phones (item 9).** In `frameSetForViewport`, return `"mobile"` only when `width <= 768 && height >= width` (portrait-ish). Landscape small screens fall through to the desktop tiers (drawn `cover`). Update/add unit tests: `740×360 @2` → `"desktop"`; `768×1024` → `"mobile"`; `375×812 @3` → `"mobile"`; `600×600` → `"mobile"`.

**Tests to add/update:** `stillUrl`; `frameSetForViewport` cases above; `prefersLightweightMedia` (stub `navigator.connection` via `Object.defineProperty(navigator, "connection", { value: …, configurable: true })`, restore after); HeroPour: static variant under reduced motion shows `still.webp` (not poster) and no canvas; static variant when `saveData: true` with motion allowed (no canvas, no `Image` constructed); motion variant section has `h-[200vh]` and stage `h-[100svh]`.

**Docs:** update the spec's Hero/Reduced-motion/Assets text for still.webp, svh, data saver, 200vh, and the landscape rule.

---

### Task 2: Header — sticky solid state, mobile menu, overlay theme picker (items 4, 5, 6)

**Files:** `frontend/src/components/layout/Header.tsx` (+test), `ThemeSwitcher.tsx` (+test), `PageShell.tsx` (+test), new `frontend/src/hooks/useScrolledPast.ts` (+test), `frontend/src/components/home/HeroPour.tsx` (sentinel + copy padding).

1. **Sticky header on home (item 4).** On `/`, the header is `fixed inset-x-0 top-0 z-20` (not `absolute`). HeroPour renders a sentinel `<div id="hero-end" aria-hidden="true" />` immediately after the hero `<section>` (before the cellar fade) in both branches. New hook `useScrolledPast(elementId: string): boolean` — IntersectionObserver on that element; returns true when the sentinel's `boundingClientRect.top` is above the viewport top (`< 0`) and it is not intersecting; false otherwise; false if the element or `IntersectionObserver` is missing. PageShell passes `overlay={isHome && !scrolledPast}` and a new prop `fixed={isHome}` to Header. Header styles:
   - overlay (over the hero): transparent, no border, cellar text colors (as today).
   - fixed but not overlay (scrolled past the hero): `bg-surface/95 backdrop-blur border-b border-surface-border`, theme text colors, `motion-safe:transition-colors`.
   - not fixed (other routes): unchanged (`border-b border-surface-border`, in flow).
   Tailwind note: `bg-surface/95` needs the color to support alpha; `surface` is `var(--color-surface)` (hex), so use an arbitrary value such as `bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)]` or a plain `bg-surface` if color-mix is unsupported by the build — pick one, verify it renders.
2. **Mobile menu (item 5).** Below `md`, the header shows one row: brand + a menu button (`aria-expanded`, `aria-controls`, accessible name "Menu"). The desktop nav/theme/admin group is `hidden md:flex` and **always rendered** (so existing `App.test.tsx` link queries keep working). When the button is open, a panel (conditionally rendered) lists the five nav links, the theme switcher, and Admin; it closes on link click, on Escape, and on route change. Applies to every page. After this, HeroPour's mobile copy padding goes back from `pt-40` to `pt-24` (header is one row now).
3. **Overlay theme picker (item 6).** `ThemeSwitcher` gains `variant?: "default" | "overlay"`; overlay uses a translucent dark background (`bg-black/30`), `border-cellar-muted/40` (or an arbitrary equivalent that works with the var-based token), and `text-cellar-ink`; keep `<option>` elements readable (give them `bg-surface text-ink`). Header passes `variant="overlay"` when overlay.

**Tests:** `useScrolledPast` (stub IO; false initially, true when entry is above viewport, false again when back in view, false without IO/element). Header: fixed+overlay vs fixed+solid vs default classes; menu button toggles panel (`aria-expanded`), panel contains the five links + Admin, Escape closes, clicking a link closes. ThemeSwitcher overlay classes. PageShell: home renders fixed header; overlay flips off when the scrolled-past hook reports true (stub IO or mock the hook module). Keep `App.test.tsx` green.

---

### Task 3: Explore scene variety (item 7)

**Files:** `frontend/src/components/home/scenes/ExploreScene.tsx` (+test).

Replace the single `listWines({ limit: 3 })` with three parallel requests, one per color in the scene's color thread: `listWines({ type: "red", limit: 20 })`, `{ type: "white", limit: 20 }`, `{ type: "rosé", limit: 20 }` (valid backend types: red, white, rosé, sparkling, dessert, fortified). From each successful response pick one wine at random (`Math.random`); keep order red, white, rosé; skip types that fail or return nothing. If fewer than 3 wines result, top up from any remaining items across the responses (no duplicates by id). Loading → skeletons as now; all three failing or zero wines → existing fallback copy. Guard against state updates after unmount as today.

**Tests:** update existing ExploreScene tests for the new call shape (assert the three calls); deterministic pick with `vi.spyOn(Math, "random")`; order red/white/rosé; one type failing still shows the other two plus a top-up; all failing → fallback copy.

---

### Task 4: Shared test stubs (item 10)

**Files:** new `frontend/src/test/stubs.ts`; test files that duplicate stubs (at least `components/home/Scene.test.tsx`, `components/home/HeroPour.test.tsx`, `pages/HomePage.test.tsx`, `App.test.tsx`, `hooks/useInView.test.tsx`, `hooks/usePrefersReducedMotion.test.tsx`, `components/home/scenes/*.test.tsx`, plus any new ones from Tasks 1–3 — grep for `stubGlobal(` and `IntersectionObserver`).

Export focused helpers: `stubMatchMedia({ reducedMotion?: boolean, matches?: (query) => boolean })` returning an `emit(matches)` for change events; `stubIntersectionObserver()` returning the created instances/callbacks and a `fire(index, isIntersecting, top?)` helper; `stubConnection(value | undefined)` with restore. Replace the duplicated local helpers with imports; behavior of every test unchanged. `CompareTiles.test.tsx`'s column-count stub may stay local if it doesn't fit. Test count must not drop.
