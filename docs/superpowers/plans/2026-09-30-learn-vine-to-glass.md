# Learn Page, Part 2: Vine to Glass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Vine to Glass chapter to `/learn`, a 7-stage winemaking timeline whose gold spine grows with scroll, and make the chapter nav visible with the three fixes deferred from Part 1.

**Architecture:** Static content in `content/learn/vine.ts` feeds `VineChapter`, which renders a spine (a `bg-accent` bar scaled by a new `throughProgress` scroll function) and seven `VineStage`s that reveal with Part 1's `useReveal`. Style differences are shown with `StyleCallout` chips linking to Explore's `?type=` filter. The chapter is appended to `LEARN_CHAPTERS`, which makes `ChapterNav` render.

**Tech Stack:** React 18, TypeScript, React Router 6, Tailwind 3, Vitest 2 + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-30-learn-vine-to-glass-design.md`

## Global Constraints

- All paths are relative to `frontend/` unless they start with `docs/`.
- Run tests from `frontend/`: `npx vitest run <path>`; full suite `npx vitest run`; type-check + build `npm run build`. Baseline on `main`: 63 files, 424 tests, all passing.
- Test-first for every task: failing test, watch it fail, implement, watch it pass, commit.
- No new npm dependencies. No backend changes.
- Every CSS rule in `home.css` / `learn.css` outside `.scene-animate:not(.is-visible)` describes the finished look, so reduced motion and no `IntersectionObserver` show complete art. Only `transform`, `opacity`, and `stroke-dashoffset` animate.
- Line art: gold strokes via `stroke-accent`; wine colors (`fill-wine-red`, `fill-wine-white`, `fill-wine-rose`) are the only fills. Art containers are `aria-hidden="true"`; every `.draw` element has `pathLength={1}`.
- All Learn copy lives in `src/content/learn/`, never in components. Every entry carries `source: "general" | "course"`; everything new is `"general"`. The source is never shown.
- Callout styles are exactly the dataset types `red`, `white`, `rosé`, `sparkling`, `fortified` (`rosé` with the accent). Callout links go to `/explore?type=<encodeURIComponent(style)>`.
- Tailwind wine colors are plain CSS variables, so opacity modifiers like `bg-wine-red/10` do NOT work; use the bare classes (`bg-wine-red`, `border-wine-red`, …).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on branch `feature/learn-vine` (the controller creates it before Task 1).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/hooks/useScrollProgress.ts` (+ test) | Modify | Add `throughProgress`; optional `progressFn` parameter |
| `src/content/learn/vine.ts` (+ test) | Create | `VINE_CHAPTER`, `VINE_STAGES`, `WineStyle`, `StageId` |
| `src/hooks/useActiveChapter.ts` (+ test) | Modify | Pick the intersecting entry nearest the band |
| `src/components/learn/ChapterNav.tsx` (+ test) | Modify | No observer while hidden |
| `src/components/learn/taste/DimensionBlock.tsx` (+ test) | Modify | Fixed-min-height pair area |
| `src/components/learn/learn.css` | Modify | `.press` and `.rise` art actions |
| `src/components/learn/vine/art/*.tsx`, `art/index.ts` (+ test) | Create | Six stage SVGs + `STAGE_ART` |
| `src/components/learn/vine/StyleCallout.tsx` (+ test) | Create | Wine-colored callout with Explore link |
| `src/components/learn/vine/VineStage.tsx` (+ test) | Create | One timeline stage |
| `src/components/learn/vine/VineChapter.tsx` (+ test) | Create | Spine + stages |
| `src/components/learn/chapters.ts` | Modify | Append `vine` |
| `src/pages/LearnPage.test.tsx` | Modify | Nav visible; `#vine` deep link |
| `src/components/home/scenes/LearnScene.tsx` (+ `FeatureScenes.test.tsx`) | Modify | Copy mentions both chapters |

---

### Task 1: `throughProgress` + `progressFn` parameter

**Files:**
- Modify: `src/hooks/useScrollProgress.ts`
- Modify: `src/hooks/useScrollProgress.test.tsx`

**Interfaces:**
- Produces:
  - `export interface ProgressInput { top: number; height: number; viewportHeight: number }`
  - `export function throughProgress(input: ProgressInput & { anchor?: number }): number` — `anchor` defaults to `0.6`.
  - `useScrollProgress(ref, onProgress, enabled = true, progressFn: (input: ProgressInput) => number = scrollProgress): void`
  - `scrollProgress` keeps its current signature and behavior.

- [ ] **Step 1: Write the failing tests** — append to `src/hooks/useScrollProgress.test.tsx`. Change the import line to:

```tsx
import { scrollProgress, throughProgress, useScrollProgress } from "./useScrollProgress";
```

Add this `describe` after the `scrollProgress` one:

```tsx
describe("throughProgress", () => {
  // viewportHeight 1000 → the default anchor line sits at 600px.
  it("is 0 until the element's top reaches the anchor line", () => {
    expect(throughProgress({ top: 900, height: 2000, viewportHeight: 1000 })).toBe(0);
    expect(throughProgress({ top: 600, height: 2000, viewportHeight: 1000 })).toBe(0);
  });

  it("is proportional while the anchor line travels through the element", () => {
    expect(throughProgress({ top: -400, height: 2000, viewportHeight: 1000 })).toBe(0.5);
  });

  it("is 1 once the element's bottom has passed the anchor line", () => {
    expect(throughProgress({ top: -1400, height: 2000, viewportHeight: 1000 })).toBe(1);
    expect(throughProgress({ top: -5000, height: 2000, viewportHeight: 1000 })).toBe(1);
  });

  it("accepts a custom anchor", () => {
    expect(throughProgress({ top: 0, height: 1000, viewportHeight: 1000, anchor: 0.5 })).toBe(0.5);
  });

  it("handles zero-height elements", () => {
    expect(throughProgress({ top: 700, height: 0, viewportHeight: 1000 })).toBe(0);
    expect(throughProgress({ top: 100, height: 0, viewportHeight: 1000 })).toBe(1);
  });
});
```

Inside the existing `describe("useScrollProgress", …)`, add after the last test:

```tsx
  it("uses a custom progress function when given one", () => {
    const onProgress = vi.fn();

    function CustomProbe() {
      const ref = useRef<HTMLDivElement>(null);
      useScrollProgress(ref, onProgress, true, () => 0.42);
      return <div ref={ref} />;
    }

    render(<CustomProbe />);
    expect(onProgress).toHaveBeenLastCalledWith(0.42);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/hooks/useScrollProgress.test.tsx`
Expected: FAIL — `throughProgress` is not exported; the custom-function test reports a value other than 0.42.

- [ ] **Step 3: Implement** — in `src/hooks/useScrollProgress.ts`, replace the `scrollProgress` declaration and the hook's signature/body as follows (keep the rest of the file):

```ts
import { useEffect, useRef, type RefObject } from "react";

export interface ProgressInput {
  top: number;
  height: number;
  viewportHeight: number;
}

// Progress of an element through the part of its height that extends past the
// viewport — i.e. how far a sticky child pinned inside it has been scrubbed.
export function scrollProgress({ top, height, viewportHeight }: ProgressInput): number {
  const range = height - viewportHeight;
  if (range <= 0) return top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / range));
}

// How far a reading line `anchor` of the way down the viewport has travelled
// through an element — for things that grow alongside the reader, not pinned ones.
export function throughProgress({ top, height, viewportHeight, anchor = 0.6 }: ProgressInput & { anchor?: number }): number {
  const line = anchor * viewportHeight;
  if (height <= 0) return top <= line ? 1 : 0;
  return Math.min(1, Math.max(0, (line - top) / height));
}

export function useScrollProgress(
  ref: RefObject<HTMLElement>,
  onProgress: (progress: number) => void,
  enabled = true,
  progressFn: (input: ProgressInput) => number = scrollProgress
): void {
  const callbackRef = useRef(onProgress);
  const progressFnRef = useRef(progressFn);

  useEffect(() => {
    callbackRef.current = onProgress;
    progressFnRef.current = progressFn;
  });
```

and inside `update`, change the progress line to:

```ts
      callbackRef.current(progressFnRef.current({ top: rect.top, height: rect.height, viewportHeight: window.innerHeight }));
```

(The effect's dependency list stays `[ref, enabled]`.)

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/hooks/useScrollProgress.test.tsx src/components/home/HeroPour.test.tsx`
Expected: all PASS (the hero still uses the default).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScrollProgress.ts src/hooks/useScrollProgress.test.tsx
git commit -m "feat: add throughProgress and a pluggable progress function to useScrollProgress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Vine to Glass content

**Files:**
- Create: `src/content/learn/vine.ts`
- Create: `src/content/learn/vine.test.ts`

**Interfaces:**
- Consumes: `type ContentSource` from `src/content/learn/types.ts`.
- Produces:
  ```ts
  export type WineStyle = "red" | "white" | "rosé" | "sparkling" | "fortified";
  export const WINE_STYLES: readonly WineStyle[];
  export type StageId = "vineyard" | "harvest" | "crush" | "ferment" | "age" | "bottle" | "glass";
  export interface StyleCalloutContent { style: WineStyle; text: string }
  export interface VineStageContent {
    id: StageId; title: string; what: string; why: string;
    callouts?: readonly StyleCalloutContent[];
    link?: { href: string; label: string };
    source: ContentSource;
  }
  export const VINE_CHAPTER: { id: "vine"; label: string; title: string; lead: string; source: ContentSource };
  export const VINE_STAGES: readonly VineStageContent[];
  ```

- [ ] **Step 1: Write the failing test** — `src/content/learn/vine.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { VINE_CHAPTER, VINE_STAGES, WINE_STYLES } from "./vine";

describe("Vine to Glass content", () => {
  it("has chapter strings", () => {
    expect(VINE_CHAPTER.id).toBe("vine");
    expect(VINE_CHAPTER.label).toBe("Vine to Glass");
    expect(VINE_CHAPTER.title).toBe("From vine to glass");
    expect(VINE_CHAPTER.lead.trim()).not.toBe("");
  });

  it("has the seven stages in order", () => {
    expect(VINE_STAGES.map((stage) => stage.id)).toEqual([
      "vineyard",
      "harvest",
      "crush",
      "ferment",
      "age",
      "bottle",
      "glass",
    ]);
  });

  it.each(VINE_STAGES.map((stage) => [stage.id, stage] as const))("%s has copy and a source", (_id, stage) => {
    for (const text of [stage.title, stage.what, stage.why]) expect(text.trim()).not.toBe("");
    expect(["general", "course"]).toContain(stage.source);
  });

  it("only uses dataset wine types for callouts", () => {
    expect(WINE_STYLES).toEqual(["red", "white", "rosé", "sparkling", "fortified"]);
    for (const stage of VINE_STAGES) {
      for (const callout of stage.callouts ?? []) {
        expect(WINE_STYLES).toContain(callout.style);
        expect(callout.text.trim()).not.toBe("");
      }
    }
  });

  it("puts the style callouts where styles differ", () => {
    const styles = (id: string) => (VINE_STAGES.find((stage) => stage.id === id)?.callouts ?? []).map((c) => c.style);
    expect(styles("crush")).toEqual(["white", "rosé", "red"]);
    expect(styles("ferment")).toEqual(["red", "fortified"]);
    expect(styles("bottle")).toEqual(["sparkling"]);
  });

  it("ends by pointing back to How to Taste", () => {
    expect(VINE_STAGES[VINE_STAGES.length - 1].link).toEqual({ href: "#taste", label: "Now taste it: How to Taste ↑" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/content/learn/vine.test.ts`
Expected: FAIL — cannot resolve `./vine`.

- [ ] **Step 3: Implement** — `src/content/learn/vine.ts` (save as UTF-8; it contains `é`, `₂` and `↑`)

```ts
import type { ContentSource } from "./types";

/** The dataset's `type` values that differ in how they're made; Explore filters on these. */
export type WineStyle = "red" | "white" | "rosé" | "sparkling" | "fortified";
export const WINE_STYLES: readonly WineStyle[] = ["red", "white", "rosé", "sparkling", "fortified"];

export type StageId = "vineyard" | "harvest" | "crush" | "ferment" | "age" | "bottle" | "glass";

export interface StyleCalloutContent {
  style: WineStyle;
  text: string;
}

export interface VineStageContent {
  id: StageId;
  title: string;
  /** What happens at this stage. */
  what: string;
  /** How it shows up in what you taste. */
  why: string;
  callouts?: readonly StyleCalloutContent[];
  link?: { href: string; label: string };
  source: ContentSource;
}

export const VINE_CHAPTER = {
  id: "vine",
  label: "Vine to Glass",
  title: "From vine to glass",
  lead: "Every glass starts as a grape. Follow the vine down the page to see where the sweetness, acidity, tannin and body you just met actually come from.",
  source: "general",
} as const satisfies { id: "vine"; label: string; title: string; lead: string; source: ContentSource };

export const VINE_STAGES: readonly VineStageContent[] = [
  {
    id: "vineyard",
    title: "Vineyard",
    what: "Grapes are farmed like any fruit, but where they grow matters enormously. Climate, soil, sunlight and slope, together called terroir, shape how ripe the grapes get. A new vine takes about three years to bear fruit worth making into wine.",
    why: "Warm, sunny places give riper grapes: more sugar, more alcohol and body, softer acidity. Cool places keep acidity bright and fruit more restrained.",
    source: "general",
  },
  {
    id: "harvest",
    title: "Harvest",
    what: "In late summer or fall, growers taste and test the grapes and pick when sugar and acidity are in balance. Some vineyards harvest by hand, cluster by cluster; others use machines that shake the berries loose.",
    why: "Pick late and the wine leans riper and sweeter; pick early and it stays crisp and tart. This is the first place sweetness and acidity are decided.",
    source: "general",
  },
  {
    id: "crush",
    title: "Crush & Press",
    what: "At the winery the grapes are pulled off their stems and gently crushed to break the skins and free the juice. Nearly all grape juice runs clear, whatever color the skins are.",
    why: "Color, and much of the tannin, lives in the skins, so what happens to them next decides the wine's style.",
    callouts: [
      { style: "white", text: "Pressed right away, so the juice leaves the skins before it picks up any color." },
      { style: "rosé", text: "Left on the skins for just a few hours, long enough for a blush of color." },
      { style: "red", text: "The skins stay in with the juice for the next step." },
    ],
    source: "general",
  },
  {
    id: "ferment",
    title: "Fermentation",
    what: "Yeast eats the grape sugar and turns it into alcohol and carbon dioxide (CO₂). Most fermentations take one to three weeks, in steel tanks or wooden vats.",
    why: "Let it finish and the wine is dry; stop it early and some sugar stays behind as sweetness. More sugar at the start means more alcohol, and more body.",
    callouts: [
      { style: "red", text: "Ferments with its skins, soaking up color and tannin as it goes." },
      { style: "fortified", text: "Brandy is added partway through, which stops the yeast and leaves the wine sweet and strong, as in Port." },
    ],
    source: "general",
  },
  {
    id: "age",
    title: "Aging",
    what: "The new wine rests for months or years before bottling. Stainless steel tanks keep it sealed off from air; oak barrels let in a little oxygen and lend flavors of their own.",
    why: "Steel keeps a wine fresh and fruit-forward. Oak rounds it out with notes of vanilla, toast and spice, plus a touch of tannin.",
    source: "general",
  },
  {
    id: "bottle",
    title: "Blending & Bottling",
    what: "Winemakers often blend grapes or barrels to balance the final wine, then clarify it by fining and filtering, and bottle it.",
    why: "Blending is how a winemaker fine-tunes the five scales: a little more acidity here, softer tannin there.",
    callouts: [
      { style: "sparkling", text: "A second fermentation happens inside the sealed bottle. Its CO₂ has nowhere to go, so it becomes the bubbles." },
    ],
    source: "general",
  },
  {
    id: "glass",
    title: "In Your Glass",
    what: "Some wines keep improving in the bottle for years as their tannins soften; most are made to enjoy within a few years. Then it's opened, poured and served.",
    why: "Everything upstream, from the vineyard's sunshine to the barrel, ends up as what you taste.",
    link: { href: "#taste", label: "Now taste it: How to Taste ↑" },
    source: "general",
  },
];
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/content/learn/vine.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/learn/vine.ts src/content/learn/vine.test.ts
git commit -m "feat(learn): add Vine to Glass stage copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Chapter-nav fixes deferred from Part 1

**Files:**
- Modify: `src/hooks/useActiveChapter.ts`, `src/hooks/useActiveChapter.test.tsx`
- Modify: `src/components/learn/ChapterNav.tsx`, `src/components/learn/ChapterNav.test.tsx`
- Modify: `src/components/learn/taste/DimensionBlock.tsx`, `src/components/learn/taste/DimensionBlock.test.tsx`

**Interfaces:**
- Consumes: `stubIntersectionObserver` from `src/test/stubs.ts`.
- Produces: no new exports. `useActiveChapter` keeps its signature; `DimensionBlock` wraps its pair in `<div data-testid="pair-area" className="min-h-[18rem] sm:min-h-[9.5rem]">` in every state.

- [ ] **Step 1: Rewrite the hook test** — replace `src/hooks/useActiveChapter.test.tsx` with:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useActiveChapter } from "./useActiveChapter";
import { stubIntersectionObserver, type FakeIntersectionObserverInstance } from "../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ ids }: { ids: string[] }) {
  const active = useActiveChapter(ids);
  return (
    <>
      {ids.map((id) => (
        <section key={id} id={id} />
      ))}
      <p data-testid="active">{active ?? "none"}</p>
    </>
  );
}

function entry(id: string, isIntersecting: boolean, top = 0) {
  return {
    isIntersecting,
    target: document.getElementById(id)!,
    boundingClientRect: { top } as DOMRect,
  } as unknown as IntersectionObserverEntry;
}

function deliver(instance: FakeIntersectionObserverInstance, entries: IntersectionObserverEntry[]) {
  act(() => {
    instance.callback(entries, instance as unknown as IntersectionObserver);
  });
}

describe("useActiveChapter", () => {
  it("starts on the first chapter and follows the intersecting one", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
    expect(instances[0].observe).toHaveBeenCalledTimes(2);
    deliver(instances[0], [entry("vine", true)]);
    expect(screen.getByTestId("active")).toHaveTextContent("vine");
  });

  it("ignores entries that are leaving view", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    deliver(instances[0], [entry("vine", false)]);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });

  it("picks the entry nearest the band when two arrive together", () => {
    vi.stubGlobal("innerHeight", 1000); // band top = 200px
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    deliver(instances[0], [entry("vine", true, 500), entry("taste", true, 210)]);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
    deliver(instances[0], [entry("taste", true, -400), entry("vine", true, 190)]);
    expect(screen.getByTestId("active")).toHaveTextContent("vine");
  });

  it("stays on the first chapter without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });
});
```

- [ ] **Step 2: Add the nav test** — in `src/components/learn/ChapterNav.test.tsx`, add the import `import { stubIntersectionObserver } from "../../test/stubs";` and this test inside the `describe`:

```tsx
  it("does not observe chapters while hidden", () => {
    const { instances } = stubIntersectionObserver();
    // The section must exist, or the hook would skip observing for that reason instead.
    render(
      <>
        <section id="taste" />
        <ChapterNav chapters={[{ id: "taste", label: "How to Taste" }]} />
      </>
    );
    expect(instances).toHaveLength(0);
  });
```

- [ ] **Step 3: Add the pair-area test** — in `src/components/learn/taste/DimensionBlock.test.tsx`, add inside the `describe`:

```tsx
  it.each([
    ["loading", { status: "loading" } as PairState],
    ["ready", { status: "ready", low: wine(3, "Light Red", 2), high: wine(4, "Big Red", 5) } as PairState],
    ["hidden", { status: "hidden" } as PairState],
  ])("reserves the same pair-area height while %s", (_label, pair) => {
    renderBlock(pair);
    const area = screen.getByTestId("pair-area");
    expect(area).toHaveClass("min-h-[18rem]");
    expect(area).toHaveClass("sm:min-h-[9.5rem]");
  });
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npx vitest run src/hooks/useActiveChapter.test.tsx src/components/learn/ChapterNav.test.tsx src/components/learn/taste/DimensionBlock.test.tsx`
Expected: FAIL — "picks the entry nearest the band" reports `vine` first; the nav test sees 1 observer; `pair-area` not found.

- [ ] **Step 5: Implement the hook fix** — in `src/hooks/useActiveChapter.ts`, replace the band constant and the observer callback:

```ts
// A chapter counts as "current" while it crosses a band just below the sticky nav.
const ACTIVE_BAND = "-20% 0px -70% 0px";
// The band's top edge, as a fraction of the viewport (matches the -20% top margin above).
const BAND_TOP = 0.2;
```

```ts
    const observer = new IntersectionObserver(
      (entries) => {
        // Fast scrolls and anchor jumps can deliver several entering chapters at once; take the one nearest the band.
        const bandTop = window.innerHeight * BAND_TOP;
        let nearest: IntersectionObserverEntry | undefined;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const distance = Math.abs(entry.boundingClientRect.top - bandTop);
          if (!nearest || distance < Math.abs(nearest.boundingClientRect.top - bandTop)) nearest = entry;
        }
        if (nearest) setActive(nearest.target.id);
      },
      { rootMargin: ACTIVE_BAND }
    );
```

- [ ] **Step 6: Implement the nav fix** — in `src/components/learn/ChapterNav.tsx`, replace the first lines of the component body:

```tsx
export function ChapterNav({ chapters }: { chapters: readonly ChapterLink[] }) {
  // A one-item bar is noise; it appears once a second chapter ships. Until then, observe nothing.
  const visible = chapters.length >= 2;
  const active = useActiveChapter(visible ? chapters.map((chapter) => chapter.id) : []);
  if (!visible) return null;
```

- [ ] **Step 7: Implement the pair-area fix** — in `src/components/learn/taste/DimensionBlock.tsx`, add above `markersFor`:

```tsx
// Same height in every pair state, so content below (and /learn#<later-chapter> jumps) doesn't shift as pairs load.
// Sized to the ready layout: two stacked cards on phones, side by side from `sm`.
const PAIR_AREA_CLASS = "min-h-[18rem] sm:min-h-[9.5rem]";
```

and replace `<Pair content={content} pair={pair} />` with:

```tsx
        <div data-testid="pair-area" className={PAIR_AREA_CLASS}>
          <Pair content={content} pair={pair} />
        </div>
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/hooks/useActiveChapter.test.tsx src/components/learn src/pages/LearnPage.test.tsx`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useActiveChapter.ts src/hooks/useActiveChapter.test.tsx src/components/learn/ChapterNav.tsx src/components/learn/ChapterNav.test.tsx src/components/learn/taste/DimensionBlock.tsx src/components/learn/taste/DimensionBlock.test.tsx
git commit -m "fix(learn): ready the chapter nav for a second chapter

Pick the entering chapter nearest the band, skip observing while the nav
is hidden, and reserve a fixed pair-area height so later chapters don't
shift as example wines load.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Stage art + `learn.css` actions

**Files:**
- Modify: `src/components/learn/learn.css`
- Create: `src/components/learn/vine/art/VineyardArt.tsx`, `HarvestArt.tsx`, `CrushArt.tsx`, `FermentArt.tsx`, `AgeArt.tsx`, `BottleArt.tsx`, `GlassArt.tsx`
- Create: `src/components/learn/vine/art/index.ts`
- Create: `src/components/learn/vine/art/art.test.tsx`

**Interfaces:**
- Consumes: `Glass` from `src/components/home/art/Glass.tsx`; `cssVars` from `src/components/home/art/cssVars.ts`; `type StageId` from `src/content/learn/vine.ts`.
- Produces: `export const STAGE_ART: Record<StageId, () => JSX.Element>` from `art/index.ts`. Uses classes `draw` (with `pathLength={1}`), `pop`, `fill-up` (Part 1), and two new ones: `press` (slides down into place) and `rise` (bubbles float up and fade, three times, then rest).

- [ ] **Step 1: Write the failing test** — `src/components/learn/vine/art/art.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { STAGE_ART } from ".";
import { VINE_STAGES } from "../../../../content/learn/vine";

const STAGE_IDS = VINE_STAGES.map((stage) => stage.id);

describe("STAGE_ART", () => {
  it("has art for every stage", () => {
    expect(Object.keys(STAGE_ART).sort()).toEqual([...STAGE_IDS].sort());
  });

  it.each(STAGE_IDS)("%s renders one unfocusable svg whose drawn strokes are normalized", (id) => {
    const Art = STAGE_ART[id];
    const { container } = render(<Art />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute("focusable", "false");
    const strokes = container.querySelectorAll(".draw");
    expect(strokes.length).toBeGreaterThan(0);
    for (const stroke of strokes) expect(stroke).toHaveAttribute("pathLength", "1");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/vine/art`
Expected: FAIL — cannot resolve `.`.

- [ ] **Step 3: Add the CSS actions** — append to `src/components/learn/learn.css`, before the smooth-scroll `@media` block:

```css
.scene .press,
.scene .rise {
  transform-box: fill-box;
}

/* Resting: the press plate is down. On reveal it slides down into place. */
.scene .press {
  transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) var(--delay, 0s);
}

.scene-animate:not(.is-visible) .press {
  transform: translateY(-24px);
}

/* Resting: bubbles sit in place. On reveal they float up and fade three times, then settle back. */
.scene-animate.is-visible .rise {
  animation: learn-rise 1.8s ease-out var(--delay, 0s) 3;
}

@keyframes learn-rise {
  0% {
    transform: none;
    opacity: 1;
  }
  100% {
    transform: translateY(var(--rise-y, -30px));
    opacity: 0;
  }
}
```

- [ ] **Step 4: Implement** — `src/components/learn/vine/art/VineyardArt.tsx`

A hillside with trellis posts, a vine canopy, grapes, and a sun.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const POSTS: ReadonlyArray<readonly [x: number, base: number]> = [
  [40, 138],
  [80, 126],
  [120, 120],
  [160, 122],
  [200, 118],
];
const GRAPES: ReadonlyArray<readonly [x: number, y: number]> = [
  [60, 110],
  [100, 102],
  [140, 102],
  [180, 100],
];
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

export function VineyardArt() {
  return (
    <svg viewBox="0 0 240 180" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M0 150 Q80 104 160 128 T240 118" fill="none" strokeWidth="1.6" />
      {POSTS.map(([x, base], i) => (
        <path
          key={x}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.3 + i * 0.08}s` })}
          d={`M${x} ${base} V${base - 24}`}
          fill="none"
          strokeWidth="1.2"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.8s" })}
        d="M40 114 Q60 102 80 102 Q100 94 120 96 Q140 92 160 98 Q180 92 200 94"
        fill="none"
        strokeWidth="1.2"
      />
      {GRAPES.map(([x, y], i) => (
        <circle
          key={x}
          className="pop fill-wine-red"
          style={cssVars({ "--delay": `${1.2 + i * 0.1}s` })}
          cx={x}
          cy={y}
          r="3.5"
        />
      ))}
      <circle className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.2s" })} cx="196" cy="40" r="14" fill="none" strokeWidth="1.2" />
      {RAYS.map((angle, i) => {
        const radians = (angle * Math.PI) / 180;
        const x1 = 196 + Math.cos(radians) * 20;
        const y1 = 40 + Math.sin(radians) * 20;
        const x2 = 196 + Math.cos(radians) * 27;
        const y2 = 40 + Math.sin(radians) * 27;
        return (
          <path
            key={angle}
            className="pop stroke-accent"
            style={cssVars({ "--delay": `${0.6 + i * 0.05}s` })}
            d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
            fill="none"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 5: Implement** — `src/components/learn/vine/art/HarvestArt.tsx`

A woven harvest basket full of grapes.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const GRAPES: ReadonlyArray<readonly [x: number, y: number]> = [
  [90, 112],
  [104, 108],
  [118, 112],
  [132, 108],
  [97, 99],
  [111, 95],
  [125, 99],
];

export function HarvestArt() {
  return (
    <svg viewBox="0 0 220 200" className="w-full max-w-xs mx-auto" focusable="false">
      {GRAPES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="pop fill-wine-red stroke-accent"
          style={cssVars({ "--delay": `${0.9 + i * 0.08}s` })}
          cx={x}
          cy={y}
          r="7"
          fillOpacity="0.85"
          strokeWidth="0.8"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.3s" })}
        d="M70 120 Q110 52 150 120"
        fill="none"
        strokeWidth="1.4"
      />
      <path className="draw stroke-accent" pathLength={1} d="M50 120 H170 L155 180 H65 Z" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.5s" })} d="M55 140 H165" fill="none" strokeWidth="0.9" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.6s" })} d="M60 160 H160" fill="none" strokeWidth="0.9" />
    </svg>
  );
}
```

- [ ] **Step 6: Implement** — `src/components/learn/vine/art/CrushArt.tsx`

A basket press: the plate slides down and red juice pools underneath.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const SLATS = [90, 110, 130];

export function CrushArt() {
  return (
    <svg viewBox="0 0 220 210" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M50 30 V170 M170 30 V170 M40 30 H180" fill="none" strokeWidth="1.6" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.2s" })} d="M110 30 V62" fill="none" strokeWidth="1.4" />
      <path
        className="press stroke-accent"
        style={cssVars({ "--delay": "0.9s" })}
        d="M72 70 H148 V80 H72 Z"
        fill="none"
        strokeWidth="1.4"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M70 86 V160 H150 V86" fill="none" strokeWidth="1.4" />
      {SLATS.map((x, i) => (
        <path
          key={x}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.5 + i * 0.08}s` })}
          d={`M${x} 86 V160`}
          fill="none"
          strokeWidth="0.8"
        />
      ))}
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.7s" })} d="M58 182 H162" fill="none" strokeWidth="1.4" />
      <ellipse className="pop fill-wine-red" style={cssVars({ "--delay": "1.5s" })} cx="110" cy="176" rx="30" ry="5" fillOpacity="0.85" />
    </svg>
  );
}
```

- [ ] **Step 7: Implement** — `src/components/learn/vine/art/FermentArt.tsx`

A fermentation tank filled with red wine, with rising bubbles and an airlock.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const BUBBLES: ReadonlyArray<readonly [x: number, y: number, r: number]> = [
  [80, 160, 3],
  [100, 150, 4],
  [120, 165, 3],
  [90, 125, 2.5],
  [112, 118, 3.5],
  [128, 135, 2.5],
];

export function FermentArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-xs mx-auto" focusable="false">
      <rect
        className="fill-up fill-wine-red"
        style={cssVars({ "--delay": "0.6s" })}
        x="62"
        y="80"
        width="76"
        height="108"
        fillOpacity="0.7"
      />
      {BUBBLES.map(([x, y, r], i) => (
        <circle
          key={`${x}-${y}`}
          className="rise stroke-accent"
          style={cssVars({ "--delay": `${1.2 + i * 0.2}s`, "--rise-y": "-36px" })}
          cx={x}
          cy={y}
          r={r}
          fill="none"
          strokeWidth="1"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        d="M60 40 H140 V180 Q140 190 130 190 H70 Q60 190 60 180 Z"
        fill="none"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.3s" })} d="M100 40 V24 q10 0 10 -8" fill="none" strokeWidth="1.2" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M72 190 V206 M128 190 V206" fill="none" strokeWidth="1.4" />
    </svg>
  );
}
```

- [ ] **Step 8: Implement** — `src/components/learn/vine/art/AgeArt.tsx`

An oak barrel on a stand, with staves and hoops drawing in.

```tsx
import { cssVars } from "../../../home/art/cssVars";

export function AgeArt() {
  return (
    <svg viewBox="0 0 220 180" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M50 40 Q38 90 50 140 H170 Q182 90 170 40 Z" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.3s" })} d="M80 40 Q74 90 80 140" fill="none" strokeWidth="0.8" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.35s" })} d="M110 40 V140" fill="none" strokeWidth="0.8" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M140 40 Q146 90 140 140" fill="none" strokeWidth="0.8" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.7s" })} d="M46 60 Q110 66 174 60" fill="none" strokeWidth="1.4" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.8s" })} d="M46 120 Q110 114 174 120" fill="none" strokeWidth="1.4" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.5s" })} d="M36 156 H184 M62 140 V156 M158 140 V156" fill="none" strokeWidth="1.4" />
      <circle className="pop fill-wine-red" style={cssVars({ "--delay": "1.1s" })} cx="110" cy="90" r="4" />
    </svg>
  );
}
```

- [ ] **Step 9: Implement** — `src/components/learn/vine/art/BottleArt.tsx`

A bottle filling with white sparkling wine, with a label and rising bubbles.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const BUBBLES: ReadonlyArray<readonly [x: number, y: number]> = [
  [88, 180],
  [102, 170],
  [114, 184],
  [94, 150],
  [108, 140],
];

export function BottleArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-[12rem] mx-auto" focusable="false">
      <rect
        className="fill-up fill-wine-white"
        style={cssVars({ "--delay": "0.7s" })}
        x="72"
        y="110"
        width="56"
        height="88"
        fillOpacity="0.85"
      />
      {BUBBLES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="rise stroke-accent"
          style={cssVars({ "--delay": `${1.3 + i * 0.18}s`, "--rise-y": "-28px" })}
          cx={x}
          cy={y}
          r="2.5"
          fill="none"
          strokeWidth="0.9"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        d="M90 22 H110 V60 Q130 72 130 95 V200 H70 V95 Q70 72 90 60 Z"
        fill="none"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.3s" })} d="M92 12 H108 V22 H92 Z" fill="none" strokeWidth="1.2" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.5s" })} d="M76 128 H124 V164 H76 Z" fill="none" strokeWidth="1" />
    </svg>
  );
}
```

- [ ] **Step 10: Implement** — `src/components/learn/vine/art/GlassArt.tsx`

```tsx
import { Glass } from "../../../home/art/Glass";

export function GlassArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-[12rem] mx-auto" focusable="false">
      <Glass wine="red" level="mid" />
    </svg>
  );
}
```

- [ ] **Step 11: Implement** — `src/components/learn/vine/art/index.ts`

```ts
import type { StageId } from "../../../../content/learn/vine";
import { AgeArt } from "./AgeArt";
import { BottleArt } from "./BottleArt";
import { CrushArt } from "./CrushArt";
import { FermentArt } from "./FermentArt";
import { GlassArt } from "./GlassArt";
import { HarvestArt } from "./HarvestArt";
import { VineyardArt } from "./VineyardArt";

export const STAGE_ART: Record<StageId, () => JSX.Element> = {
  vineyard: VineyardArt,
  harvest: HarvestArt,
  crush: CrushArt,
  ferment: FermentArt,
  age: AgeArt,
  bottle: BottleArt,
  glass: GlassArt,
};
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run src/components/learn/vine/art`
Expected: all PASS (the `Glass` component's strokes carry `pathLength={1}` too).

- [ ] **Step 13: Commit**

```bash
git add src/components/learn/learn.css src/components/learn/vine/art
git commit -m "feat(learn): add line art for the seven winemaking stages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `StyleCallout` + `VineStage`

**Files:**
- Create: `src/components/learn/vine/StyleCallout.tsx`, `src/components/learn/vine/StyleCallout.test.tsx`
- Create: `src/components/learn/vine/VineStage.tsx`, `src/components/learn/vine/VineStage.test.tsx`

**Interfaces:**
- Consumes: `type WineStyle`, `type VineStageContent`, `VINE_STAGES` (Task 2); `STAGE_ART` (Task 4); `useReveal` from `src/hooks/useReveal.ts`; `home.css`, `learn.css`.
- Produces:
  - `export function StyleCallout({ style, text }: { style: WineStyle; text: string })`
  - `export function VineStage({ stage, index }: { stage: VineStageContent; index: number })` — renders an `<li>` (the caller supplies the `<ol>`); `index` is 0-based; text sits left on desktop when `index` is even.

- [ ] **Step 1: Write the failing callout test** — `src/components/learn/vine/StyleCallout.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StyleCallout } from "./StyleCallout";

function renderCallout(style: Parameters<typeof StyleCallout>[0]["style"], text = "Some text.") {
  return render(
    <MemoryRouter>
      <StyleCallout style={style} text={text} />
    </MemoryRouter>
  );
}

describe("StyleCallout", () => {
  it("names the style and shows its text", () => {
    renderCallout("red", "Ferments with its skins.");
    expect(screen.getByText("Red:")).toBeInTheDocument();
    expect(screen.getByText(/Ferments with its skins\./)).toBeInTheDocument();
  });

  it("links to Explore filtered by the style", () => {
    renderCallout("red");
    expect(screen.getByRole("link", { name: "Explore red wines →" })).toHaveAttribute("href", "/explore?type=red");
  });

  it("encodes accented styles in the link", () => {
    renderCallout("rosé");
    expect(screen.getByText("Rosé:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore rosé wines →" })).toHaveAttribute("href", "/explore?type=ros%C3%A9");
  });
});
```

- [ ] **Step 2: Write the failing stage test** — `src/components/learn/vine/VineStage.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VineStage } from "./VineStage";
import { VINE_STAGES } from "../../../content/learn/vine";

const CRUSH = VINE_STAGES.find((stage) => stage.id === "crush")!;
const GLASS = VINE_STAGES.find((stage) => stage.id === "glass")!;

function renderStage(stage = CRUSH, index = 2) {
  return render(
    <MemoryRouter>
      <ol>
        <VineStage stage={stage} index={index} />
      </ol>
    </MemoryRouter>
  );
}

describe("VineStage", () => {
  it("renders the step number, heading and copy", () => {
    renderStage();
    // Callouts are nested list items, so find the stage item through its heading.
    const item = screen.getByRole("heading", { level: 3, name: "Crush & Press" }).closest("li")!;
    expect(within(item).getByText("Step 3")).toBeInTheDocument();
    expect(item).toHaveTextContent("What happens");
    expect(item).toHaveTextContent(CRUSH.what);
    expect(item).toHaveTextContent("Why it matters");
    expect(item).toHaveTextContent(CRUSH.why);
  });

  it("renders a callout per style difference", () => {
    renderStage();
    expect(screen.getByRole("link", { name: "Explore white wines →" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore rosé wines →" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore red wines →" })).toBeInTheDocument();
  });

  it("hides the art and the spine node from assistive technology", () => {
    renderStage();
    expect(screen.getByTestId("stage-art")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("stage-node")).toHaveAttribute("aria-hidden", "true");
  });

  it("puts the art on the right for even stages and the left for odd ones", () => {
    const { unmount } = renderStage(CRUSH, 2);
    expect(screen.getByTestId("stage-art")).toHaveClass("md:order-last");
    unmount();
    renderStage(CRUSH, 3);
    expect(screen.getByTestId("stage-art")).not.toHaveClass("md:order-last");
  });

  it("renders the closing link back to How to Taste", () => {
    renderStage(GLASS, 6);
    expect(screen.getByRole("link", { name: "Now taste it: How to Taste ↑" })).toHaveAttribute("href", "#taste");
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/components/learn/vine/StyleCallout.test.tsx src/components/learn/vine/VineStage.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement** — `src/components/learn/vine/StyleCallout.tsx`

```tsx
import { Link } from "react-router-dom";
import type { WineStyle } from "../../../content/learn/vine";

const STYLE_LABEL: Record<WineStyle, string> = {
  red: "Red",
  white: "White",
  "rosé": "Rosé",
  sparkling: "Sparkling",
  fortified: "Fortified",
};

// Sparkling and fortified have no color token of their own; the written style name is always shown, so color is never the only signal.
const STYLE_BORDER: Record<WineStyle, string> = {
  red: "border-wine-red",
  white: "border-wine-white",
  "rosé": "border-wine-rose",
  sparkling: "border-wine-white",
  fortified: "border-wine-red",
};

export function StyleCallout({ style, text }: { style: WineStyle; text: string }) {
  const label = STYLE_LABEL[style];
  return (
    <div className={`rounded border-l-4 ${STYLE_BORDER[style]} bg-surface-raised px-3 py-2`}>
      <p className="text-sm text-ink">
        <span className="font-semibold">{label}:</span> {text}
      </p>
      <Link
        to={`/explore?type=${encodeURIComponent(style)}`}
        className="text-xs text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Explore {label.toLowerCase()} wines →
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Implement** — `src/components/learn/vine/VineStage.tsx`

The node sits on the spine: `left-6` (24px) on phones, centered from `md`. The outer span positions it (with a translate); the inner span carries `pop`, so the reveal transform never overrides the positioning one.

```tsx
import { useRef } from "react";
import { useReveal } from "../../../hooks/useReveal";
import type { VineStageContent } from "../../../content/learn/vine";
import { STAGE_ART } from "./art";
import { StyleCallout } from "./StyleCallout";
import "../../home/home.css";
import "../learn.css";

export function VineStage({ stage, index }: { stage: VineStageContent; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const reveal = useReveal(ref);
  const titleId = `vine-${stage.id}-title`;
  const Art = STAGE_ART[stage.id];
  const textFirst = index % 2 === 0;
  const classes = ["scene relative grid items-center gap-6 py-10 pl-12 md:pl-0 md:grid-cols-2 md:gap-20", ...reveal];

  return (
    <li ref={ref} aria-labelledby={titleId} className={classes.join(" ")}>
      <span
        data-testid="stage-node"
        aria-hidden="true"
        className="absolute left-6 top-12 -translate-x-1/2 md:left-1/2 md:top-1/2 md:-translate-y-1/2"
      >
        <span className="pop block h-4 w-4 rotate-45 rounded-tl-full rounded-br-full border border-accent bg-surface" />
      </span>
      <div data-testid="stage-art" aria-hidden="true" className={textFirst ? "md:order-last" : undefined}>
        <Art />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent mb-2">Step {index + 1}</p>
        <h3 id={titleId} className="font-serif text-2xl text-ink mb-4">
          {stage.title}
        </h3>
        <dl className="grid gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">What happens</dt>
            <dd className="text-ink">{stage.what}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Why it matters</dt>
            <dd className="text-ink-muted">{stage.why}</dd>
          </div>
        </dl>
        {stage.callouts && stage.callouts.length > 0 ? (
          <ul className="mt-4 grid gap-2">
            {stage.callouts.map((callout) => (
              <li key={callout.style}>
                <StyleCallout style={callout.style} text={callout.text} />
              </li>
            ))}
          </ul>
        ) : null}
        {stage.link ? (
          <a
            href={stage.link.href}
            className="mt-4 inline-block text-accent font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {stage.link.label}
          </a>
        ) : null}
      </div>
    </li>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/learn/vine/StyleCallout.test.tsx src/components/learn/vine/VineStage.test.tsx`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/learn/vine/StyleCallout.tsx src/components/learn/vine/StyleCallout.test.tsx src/components/learn/vine/VineStage.tsx src/components/learn/vine/VineStage.test.tsx
git commit -m "feat(learn): add winemaking stages with wine-style callouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `VineChapter` with the growing spine

**Files:**
- Create: `src/components/learn/vine/VineChapter.tsx`
- Create: `src/components/learn/vine/VineChapter.test.tsx`

**Interfaces:**
- Consumes: `VINE_STAGES` (Task 2); `VineStage` (Task 5); `useScrollProgress`, `throughProgress` (Task 1); `usePrefersReducedMotion` from `src/hooks/usePrefersReducedMotion.ts`; `stubMatchMedia` from `src/test/stubs.ts` (tests).
- Produces: `export function VineChapter()` — chapter body (`ChapterSection` wraps it in Task 7). Renders `data-testid="vine-timeline"` (the measured element) and `data-testid="vine-spine"` (the scaled bar).

- [ ] **Step 1: Write the failing test** — `src/components/learn/vine/VineChapter.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VineChapter } from "./VineChapter";
import { stubMatchMedia } from "../../../test/stubs";

let timelineTop = 0;

beforeEach(() => {
  timelineTop = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("innerHeight", 1000);
  // Only the timeline has real geometry: 2000px tall, top at `timelineTop`.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return (this.dataset.testid === "vine-timeline" ? { top: timelineTop, height: 2000 } : { top: 0, height: 0 }) as DOMRect;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderChapter() {
  return render(
    <MemoryRouter>
      <VineChapter />
    </MemoryRouter>
  );
}

describe("VineChapter", () => {
  it("renders the seven stages in order", () => {
    renderChapter();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Vineyard",
      "Harvest",
      "Crush & Press",
      "Fermentation",
      "Aging",
      "Blending & Bottling",
      "In Your Glass",
    ]);
  });

  it("grows the spine with scroll", () => {
    stubMatchMedia({ reducedMotion: false });
    timelineTop = -400; // anchor line at 600px is halfway through the 2000px timeline
    renderChapter();
    const spine = screen.getByTestId("vine-spine");
    expect(spine.style.transform).toBe("scaleY(0.5)");

    timelineTop = -2000;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(spine.style.transform).toBe("scaleY(1)");
  });

  it("draws the full spine and skips the scroll listener under reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });
    const addListener = vi.spyOn(window, "addEventListener");
    timelineTop = 900;
    renderChapter();
    expect(screen.getByTestId("vine-spine").style.transform).toBe("scaleY(1)");
    expect(addListener.mock.calls.some(([type]) => type === "scroll")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/vine/VineChapter.test.tsx`
Expected: FAIL — cannot resolve `./VineChapter`.

- [ ] **Step 3: Implement** — `src/components/learn/vine/VineChapter.tsx`

```tsx
import { useRef } from "react";
import { VINE_STAGES } from "../../../content/learn/vine";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { throughProgress, useScrollProgress } from "../../../hooks/useScrollProgress";
import { VineStage } from "./VineStage";

export function VineChapter() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Written straight to the element so scrolling never re-renders the chapter.
  useScrollProgress(
    timelineRef,
    (progress) => {
      if (spineRef.current) spineRef.current.style.transform = `scaleY(${progress})`;
    },
    !reducedMotion,
    throughProgress
  );

  return (
    <div ref={timelineRef} data-testid="vine-timeline" className="relative mt-8">
      <div aria-hidden="true" className="absolute inset-y-0 left-6 w-0.5 -translate-x-1/2 md:left-1/2">
        <div className="absolute inset-0 bg-surface-border" />
        {/* Starts undrawn (no flash of a full vine) unless motion is reduced; React leaves the
            transform alone afterwards because this prop only changes with the motion preference. */}
        <div
          ref={spineRef}
          data-testid="vine-spine"
          className="absolute inset-0 origin-top bg-accent"
          style={{ transform: `scaleY(${reducedMotion ? 1 : 0})` }}
        />
      </div>
      <ol className="relative">
        {VINE_STAGES.map((stage, index) => (
          <VineStage key={stage.id} stage={stage} index={index} />
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/learn/vine/VineChapter.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/vine/VineChapter.tsx src/components/learn/vine/VineChapter.test.tsx
git commit -m "feat(learn): add the Vine to Glass timeline with a scroll-grown spine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wire the chapter in, home copy, full verification

**Files:**
- Modify: `src/components/learn/chapters.ts`
- Modify: `src/pages/LearnPage.test.tsx`
- Modify: `src/components/home/scenes/LearnScene.tsx`, `src/components/home/scenes/FeatureScenes.test.tsx`

**Interfaces:**
- Consumes: `VINE_CHAPTER` (Task 2); `VineChapter` (Task 6).
- Produces: `LEARN_CHAPTERS` = `[taste, vine]`.

- [ ] **Step 1: Update the page tests** — in `src/pages/LearnPage.test.tsx`, replace the test `"hides the chapter nav while there is only one chapter"` with:

```tsx
  it("shows the chapter nav with both chapters", () => {
    renderAt("/learn");
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(within(nav).getByRole("link", { name: "How to Taste" })).toHaveAttribute("href", "#taste");
    expect(within(nav).getByRole("link", { name: "Vine to Glass" })).toHaveAttribute("href", "#vine");
  });

  it("renders the Vine to Glass chapter second", () => {
    renderAt("/learn");
    const chapter = screen.getByRole("region", { name: "From vine to glass" });
    expect(chapter).toHaveAttribute("id", "vine");
    expect(screen.getByText("02 · Vine to Glass")).toBeInTheDocument();
  });

  it("scrolls #vine into view on arrival", () => {
    renderAt("/learn#vine");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("vine"));
  });
```

and change the testing-library import to `import { render, screen, within } from "@testing-library/react";`.

- [ ] **Step 2: Update the home scene test** — in `src/components/home/scenes/FeatureScenes.test.tsx`, replace the `LearnScene` describe block with:

```tsx
describe("LearnScene", () => {
  it("describes both Learn chapters", () => {
    renderScene(LearnScene);
    expect(screen.getByText(/five things your mouth is measuring/i)).toBeInTheDocument();
    expect(screen.getByText(/from the vineyard to your glass/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx`
Expected: FAIL — no chapter nav, no `#vine` region, copy not found.

- [ ] **Step 4: Add the chapter** — `src/components/learn/chapters.ts`: add imports and the second entry.

```ts
import { TASTE_CHAPTER } from "../../content/learn/taste";
import { VINE_CHAPTER } from "../../content/learn/vine";
import { TasteChapter } from "./taste/TasteChapter";
import { VineChapter } from "./vine/VineChapter";
```

```ts
export const LEARN_CHAPTERS: readonly LearnChapter[] = [
  {
    id: TASTE_CHAPTER.id,
    label: TASTE_CHAPTER.label,
    title: TASTE_CHAPTER.title,
    lead: TASTE_CHAPTER.lead,
    Component: TasteChapter,
  },
  {
    id: VINE_CHAPTER.id,
    label: VINE_CHAPTER.label,
    title: VINE_CHAPTER.title,
    lead: VINE_CHAPTER.lead,
    Component: VineChapter,
  },
];
```

- [ ] **Step 5: Update the home copy** — in `src/components/home/scenes/LearnScene.tsx`, replace the paragraph text:

```tsx
      <p className="text-ink-muted mb-6">
        Learn the five things your mouth is measuring, with real wines to taste the difference — then follow a grape
        from the vineyard to your glass.
      </p>
```

- [ ] **Step 6: Run them to verify they pass**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx src/App.test.tsx`
Expected: all PASS. (`LearnPage.test` stubs neither `requestAnimationFrame` nor geometry; jsdom's zero-size rects make the spine fully drawn, which is fine.)

- [ ] **Step 7: Full suite and build**

Run: `npx vitest run`
Expected: all files pass, no `act(...)` warnings from the new tests.

Run: `npm run build`
Expected: `tsc -b` clean and Vite build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/learn/chapters.ts src/pages/LearnPage.test.tsx src/components/home/scenes/LearnScene.tsx src/components/home/scenes/FeatureScenes.test.tsx
git commit -m "feat(learn): add Vine to Glass as the second Learn chapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Visual check (controller / user)**

With backend + `npm run dev` running, open `/learn` at desktop and phone widths, in both themes and with reduced motion on and off. Confirm: the nav appears and highlights the chapter in view; `/learn#vine` lands on the chapter header; the spine grows with scroll and stays just ahead of the reading position; stage art draws in, the press plate drops, bubbles rise; callout links open Explore filtered by type.
