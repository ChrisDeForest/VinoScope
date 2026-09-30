# Learn Page, Part 1: Framework + How to Taste — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/learn` stub with a one-page Learn guide (intro, sticky chapter nav, chapter sections) whose first chapter, How to Taste, explains the five taste dimensions with line art, a 1–5 scale, and a low-vs-high pair of real wines.

**Architecture:** `LearnPage` renders an intro, a `ChapterNav`, and one `ChapterSection` per entry in `LEARN_CHAPTERS`. The How to Taste chapter reads all copy and wine picks from `content/learn/taste.ts`, resolves each pick through the existing `listWines({ q })` API by exact winery + name + vintage, and renders five `DimensionBlock`s. Scroll-reveal animation reuses the home page's `scene` / `scene-animate` / `is-visible` CSS contract through a new shared `useReveal` hook.

**Tech Stack:** React 18, TypeScript, React Router 6, Tailwind 3, Vitest 2 + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-30-learn-page-framework-taste-design.md`

## Global Constraints

- All paths below are relative to `frontend/` unless they start with `docs/` or `data/`.
- Run tests from `frontend/`: `npx vitest run <path>`; full suite `npx vitest run`; type-check + build `npm run build`. Baseline on `main`: 51 files, 371 tests, all passing.
- Test-first for every task: write the failing test, watch it fail, implement, watch it pass, commit.
- No new npm dependencies. No backend changes.
- Every rule in `home.css` / `learn.css` outside `.scene-animate:not(.is-visible)` describes the finished look, so reduced motion, no JS, and no `IntersectionObserver` all show complete art. Only `transform`, `opacity`, and `stroke-dashoffset` animate.
- Line art: gold strokes via `stroke-accent`; wine colors (`fill-wine-red`, `fill-wine-white`, `fill-wine-rose`) are the only fills. All art containers are `aria-hidden="true"`.
- All Learn copy lives in `src/content/learn/`, never in components. Every content entry carries `source: "general" | "course"`; everything in this plan is `"general"`. The source is never shown on the page.
- Example wines are identified by winery + name + vintage (`null` for NV), never by database id.
- Scale wording comes from `DIMENSION_LABELS` / `DIMENSION_TITLES` in `src/utils/dimensionLabels.ts`; do not duplicate it.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on branch `feature/learn-taste` (create it from `main` before Task 1).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/hooks/useReveal.ts` (+ test) | Create | Reveal classes for an element: `scene-animate` when motion allowed, `is-visible` 400 ms after first entering view |
| `src/components/home/Scene.tsx` | Modify | Use `useReveal` (behavior unchanged) |
| `src/content/learn/types.ts` | Create | `ContentSource` type |
| `src/content/learn/taste.ts` (+ tests) | Create | Chapter strings, per-dimension copy, wine picks |
| `src/hooks/useActiveChapter.ts` (+ test) | Create | Which chapter id is on screen |
| `src/components/learn/ChapterNav.tsx` (+ test) | Create | Sticky anchor bar; `null` for < 2 chapters |
| `src/components/learn/ChapterSection.tsx` | Create | `<section>` + label / `<h2>` / lead header |
| `src/components/learn/taste/DimensionScale.tsx` (+ test) | Create | 1–5 steps with example markers |
| `src/components/learn/taste/ExampleWineCard.tsx` (+ test) | Create | Compact linked wine card + skeleton |
| `src/components/learn/taste/art/*.tsx`, `art/index.ts` (+ test) | Create | Five SVG illustrations and a dimension → art map |
| `src/components/learn/learn.css` | Create | Learn-only art actions and smooth anchor scrolling |
| `src/components/learn/taste/pairs.ts` (+ test) | Create | `PairState`, `matchPick`, `loadPair` |
| `src/components/learn/taste/DimensionBlock.tsx` (+ test) | Create | One dimension: art, text, scale, pair |
| `src/components/learn/taste/TasteChapter.tsx` (+ test) | Create | Five blocks; loads all pairs |
| `src/components/learn/LearnIntro.tsx` | Create | Intro band with flourish |
| `src/components/learn/chapters.ts` | Create | `LEARN_CHAPTERS` |
| `src/pages/LearnPage.tsx` (+ test) | Create | Page composition + initial `#hash` scroll |
| `src/App.tsx`, `src/App.test.tsx` | Modify | Route to the real page |
| `src/pages/StubPages.tsx`, `src/components/common/StubPage.tsx` | Delete | Learn was their only user |
| `src/components/home/scenes/LearnScene.tsx` (+ `FeatureScenes.test.tsx`) | Modify | Current copy instead of "being poured now" |

---

### Task 1: Extract `useReveal` from `Scene`

**Files:**
- Create: `src/hooks/useReveal.ts`
- Create: `src/hooks/useReveal.test.tsx`
- Modify: `src/components/home/Scene.tsx`

**Interfaces:**
- Consumes: `useInView(ref, { delayMs })` from `src/hooks/useInView.ts`; `usePrefersReducedMotion()` from `src/hooks/usePrefersReducedMotion.ts`.
- Produces: `export const REVEAL_DELAY_MS = 400;` and `export function useReveal(ref: RefObject<Element>): string[]` — returns a subset of `["scene-animate", "is-visible"]`, in that order. `Scene.tsx` keeps exporting `SCENE_REVEAL_DELAY_MS` (now equal to `REVEAL_DELAY_MS`).

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feature/learn-taste
```

- [ ] **Step 2: Write the failing test** — `src/hooks/useReveal.test.tsx`

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useReveal, REVEAL_DELAY_MS } from "./useReveal";
import { stubIntersectionObserver, stubMatchMedia } from "../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const classes = useReveal(ref);
  return <div ref={ref} data-testid="probe" className={classes.join(" ")} />;
}

describe("useReveal", () => {
  it("waits REVEAL_DELAY_MS after entering view before adding is-visible", () => {
    vi.useFakeTimers();
    try {
      stubMatchMedia({ reducedMotion: false });
      const { fire } = stubIntersectionObserver();
      render(<Probe />);
      const probe = screen.getByTestId("probe");
      expect(probe).toHaveClass("scene-animate");
      expect(probe).not.toHaveClass("is-visible");
      fire(0, true);
      act(() => vi.advanceTimersByTime(REVEAL_DELAY_MS - 1));
      expect(probe).not.toHaveClass("is-visible");
      act(() => vi.advanceTimersByTime(1));
      expect(probe).toHaveClass("is-visible");
    } finally {
      vi.useRealTimers();
    }
  });

  it("omits scene-animate under reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });
    stubIntersectionObserver();
    render(<Probe />);
    expect(screen.getByTestId("probe")).not.toHaveClass("scene-animate");
  });

  it("is visible immediately when IntersectionObserver is unavailable", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveClass("is-visible");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/hooks/useReveal.test.tsx`
Expected: FAIL — cannot resolve `./useReveal`.

- [ ] **Step 4: Implement** — `src/hooks/useReveal.ts`

```ts
import type { RefObject } from "react";
import { useInView } from "./useInView";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Let an element settle on screen before it animates, so the motion isn't over before the eye arrives.
export const REVEAL_DELAY_MS = 400;

/**
 * Classes for the shared reveal contract in `components/home/home.css`:
 * `scene-animate` opts into the initial (hidden) state only when motion is
 * allowed, and `is-visible` switches to the finished state once in view.
 */
export function useReveal(ref: RefObject<Element>): string[] {
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(ref, { delayMs: REVEAL_DELAY_MS });
  const classes: string[] = [];
  if (!reducedMotion) classes.push("scene-animate");
  if (inView) classes.push("is-visible");
  return classes;
}
```

- [ ] **Step 5: Switch `Scene` to the hook** — in `src/components/home/Scene.tsx`, replace the imports of `useInView` / `usePrefersReducedMotion`, the `SCENE_REVEAL_DELAY_MS` definition, and the class-building lines:

```tsx
import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { REVEAL_DELAY_MS, useReveal } from "../../hooks/useReveal";
import "./home.css";

export const SCENE_REVEAL_DELAY_MS = REVEAL_DELAY_MS;
```

and inside `Scene`:

```tsx
  const ref = useRef<HTMLElement>(null);
  const reveal = useReveal(ref);
  const titleId = `${id}-title`;

  const classes = ["scene grid items-center gap-10 py-16 md:py-24 md:grid-cols-2", ...reveal];
```

(Remove the old `reducedMotion` / `inView` variables and the two `classes.push` lines. The JSX is unchanged.)

- [ ] **Step 6: Run the hook and home tests**

Run: `npx vitest run src/hooks/useReveal.test.tsx src/components/home src/pages/HomePage.test.tsx`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useReveal.ts src/hooks/useReveal.test.tsx src/components/home/Scene.tsx
git commit -m "refactor: extract scroll-reveal classes into useReveal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: How to Taste content + dataset check

**Files:**
- Create: `src/content/learn/types.ts`
- Create: `src/content/learn/taste.ts`
- Create: `src/content/learn/taste.test.ts`
- Create: `src/content/learn/taste.dataset.test.ts`

**Interfaces:**
- Consumes: `DIMENSIONS`, `type Dimension` from `src/utils/dimensionLabels.ts`.
- Produces:
  ```ts
  // types.ts
  export type ContentSource = "general" | "course";
  // taste.ts
  export interface WinePick { winery: string; name: string; vintage: number | null; reason: string }
  export interface TasteDimensionContent {
    dimension: Dimension; what: string; feel: string; tip: string;
    low: WinePick; high: WinePick; source: ContentSource;
  }
  export const TASTE_CHAPTER: { id: "taste"; label: string; title: string; lead: string; source: ContentSource };
  export const TASTE_DIMENSIONS: readonly TasteDimensionContent[]; // one per DIMENSIONS entry, same order
  ```

- [ ] **Step 1: Write the failing content test** — `src/content/learn/taste.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { TASTE_CHAPTER, TASTE_DIMENSIONS } from "./taste";

describe("How to Taste content", () => {
  it("has chapter strings", () => {
    expect(TASTE_CHAPTER.id).toBe("taste");
    expect(TASTE_CHAPTER.label).toBe("How to Taste");
    expect(TASTE_CHAPTER.title).toBe("Five things your mouth is measuring");
    expect(TASTE_CHAPTER.lead.length).toBeGreaterThan(0);
  });

  it("covers every dimension once, in DIMENSIONS order", () => {
    expect(TASTE_DIMENSIONS.map((entry) => entry.dimension)).toEqual([...DIMENSIONS]);
  });

  it.each(TASTE_DIMENSIONS.map((entry) => [entry.dimension, entry] as const))(
    "%s has copy, a low/high pair, and a source",
    (_dimension, entry) => {
      for (const text of [entry.what, entry.feel, entry.tip, entry.low.reason, entry.high.reason]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      for (const pick of [entry.low, entry.high]) {
        expect(pick.winery.trim()).not.toBe("");
        expect(pick.name.trim()).not.toBe("");
      }
      expect(["general", "course"]).toContain(entry.source);
    }
  );

  it("never reuses a wine across pairs", () => {
    const keys = TASTE_DIMENSIONS.flatMap((entry) => [entry.low, entry.high]).map(
      (pick) => `${pick.winery}|${pick.name}|${pick.vintage}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 2: Write the failing dataset test** — `src/content/learn/taste.dataset.test.ts`

This reads the cleaned CSV that the importer loads (Vite `?raw` import; verified to work from `frontend/src`).

```ts
import { describe, it, expect } from "vitest";
import csvText from "../../../../data/cleaned/wines_combined_200_currency_audited.csv?raw";
import { TASTE_DIMENSIONS, type WinePick } from "./taste";

// Minimal RFC 4180 parser: quoted fields may contain commas, newlines, and "" escapes.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => Object.fromEntries(header.map((name, j) => [name, cells[j].trim()])));
}

const rows = parseCsv(csvText);

function findRow(pick: WinePick) {
  const vintage = pick.vintage === null ? "" : String(pick.vintage);
  return rows.find((row) => row.winery === pick.winery && row.name === pick.name && row.vintage === vintage);
}

describe("How to Taste picks against the dataset", () => {
  it("parsed the dataset", () => {
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });

  it.each(TASTE_DIMENSIONS.map((entry) => [entry.dimension, entry] as const))(
    "%s: both picks exist and high beats low by at least 2",
    (dimension, entry) => {
      const low = findRow(entry.low);
      const high = findRow(entry.high);
      expect(low, `low pick not found: ${entry.low.name}`).toBeDefined();
      expect(high, `high pick not found: ${entry.high.name}`).toBeDefined();
      expect(Number(high![dimension]) - Number(low![dimension])).toBeGreaterThanOrEqual(2);
    }
  );
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npx vitest run src/content/learn`
Expected: FAIL — cannot resolve `./taste`.

- [ ] **Step 4: Implement** — `src/content/learn/types.ts`

```ts
/** Where a piece of Learn copy came from: general wine knowledge, or checked against the course notes. */
export type ContentSource = "general" | "course";
```

- [ ] **Step 5: Implement** — `src/content/learn/taste.ts`

Picks were chosen from `data/cleaned/wines_combined_200_currency_audited.csv` (scores in comments). Names must match the CSV byte-for-byte, including accents.

```ts
import type { Dimension } from "../../utils/dimensionLabels";
import type { ContentSource } from "./types";

export interface WinePick {
  winery: string;
  name: string;
  /** `null` for non-vintage wines. */
  vintage: number | null;
  /** One line on why this wine sits at this end of the scale. */
  reason: string;
}

export interface TasteDimensionContent {
  dimension: Dimension;
  what: string;
  feel: string;
  tip: string;
  low: WinePick;
  high: WinePick;
  source: ContentSource;
}

export const TASTE_CHAPTER = {
  id: "taste",
  label: "How to Taste",
  title: "Five things your mouth is measuring",
  lead: "These are the same five scales Discover and Compare use. Learn what each one feels like, then try real wines from either end.",
  source: "general",
} as const satisfies { id: "taste"; label: string; title: string; lead: string; source: ContentSource };

export const TASTE_DIMENSIONS: readonly TasteDimensionContent[] = [
  {
    dimension: "sweetness",
    what: "How much grape sugar is left after fermentation. Yeast turns sugar into alcohol; stop it early, or start with very ripe or shriveled grapes, and some sweetness remains.",
    feel: "Sweetness registers first, on the tip of your tongue. A dry wine can still taste fruity: fruit is something you smell, sugar is something you taste.",
    tip: "Pinch your nose while you sip. The aroma drops away, and what's left on the tip of your tongue is the sugar.",
    low: {
      winery: "Maison Trimbach", // sweetness 1
      name: "Trimbach Riesling",
      vintage: 2022,
      reason: "Alsace Riesling fermented fully dry, with no sugar left behind.",
    },
    high: {
      winery: "Schloss Johannisberg", // sweetness 5
      name: "Schloss Johannisberg Blaulack Riesling Trockenbeerenauslese",
      vintage: 2023,
      reason: "The same grape, made from shriveled, botrytis-affected berries picked one by one.",
    },
    source: "general",
  },
  {
    dimension: "acidity",
    what: "The tartness that makes a wine taste fresh and lively. Grapes from cooler climates hold on to more acid; warm climates ripen it away.",
    feel: "Your mouth waters, especially along the sides of your tongue, and the wine feels crisp rather than flat.",
    tip: "Right after a sip, tip your head forward slightly. The more your mouth waters, the higher the acidity.",
    low: {
      winery: "Castello del Poggio", // acidity 2 (no wine in the dataset scores 1)
      name: "Castello del Poggio Moscato",
      vintage: null,
      reason: "A soft, gentle Moscato made to feel round rather than zesty.",
    },
    high: {
      winery: "Cloudy Bay", // acidity 5
      name: "Cloudy Bay Sauvignon Blanc",
      vintage: 2023,
      reason: "Marlborough's cool nights keep this Sauvignon Blanc bright and zippy.",
    },
    source: "general",
  },
  {
    dimension: "tannin",
    what: "Compounds from grape skins, seeds and stems (and oak barrels) that give red wine its grip. White wines spend little time on their skins, so they have almost none.",
    feel: "A drying, gripping feeling on your gums and the middle of your tongue, like over-steeped black tea.",
    tip: "After a sip, run your tongue across your front teeth. The rougher they feel, the more tannin.",
    low: {
      winery: "Louis Jadot", // tannin 2
      name: "Louis Jadot Bourgogne Pinot Noir",
      vintage: 2022,
      reason: "Pinot Noir's thin skins keep even this red silky.",
    },
    high: {
      winery: "Vietti", // tannin 5
      name: "Vietti Barolo Castiglione",
      vintage: 2020,
      reason: "Nebbiolo is one of the most tannic grapes there is, and Barolo is famous for its grip.",
    },
    source: "general",
  },
  {
    dimension: "body",
    what: "How heavy and full the wine feels in your mouth. Alcohol is the biggest driver, along with sugar and extract.",
    feel: "Think skim milk, whole milk and cream: a light-bodied wine slips across your tongue, a full-bodied one coats it.",
    tip: "Check the alcohol on the label. Under about 12.5% usually feels light; over about 14% usually feels full.",
    low: {
      winery: "Joseph Drouhin", // body 1
      name: "Joseph Drouhin Chablis",
      vintage: 2022,
      reason: "Cool-climate Chablis: lean, lightly built, and low in alcohol.",
    },
    high: {
      winery: "Mollydooker", // body 5
      name: "Mollydooker The Boxer Shiraz",
      vintage: 2022,
      reason: "Ripe Australian Shiraz with high alcohol and dense extract.",
    },
    source: "general",
  },
  {
    dimension: "fruitiness",
    what: "How strongly the wine smells and tastes of fruit (berries, citrus, stone fruit) rather than earthy, mineral or savory notes.",
    feel: "Mostly in your nose: fruit-forward wines leap out of the glass, while subtle ones need a swirl to open up.",
    tip: "Swirl, then take two short sniffs and name the first fruit you think of. If nothing comes to mind, the fruit is subtle.",
    low: {
      winery: "William Fèvre", // fruitiness 2 (no wine in the dataset scores 1)
      name: "William Fèvre Chablis Domaine",
      vintage: 2022,
      reason: "Chablis shows Chardonnay's quiet side: citrus, stone and chalk.",
    },
    high: {
      winery: "Far Niente", // fruitiness 5
      name: "Far Niente Chardonnay",
      vintage: 2023,
      reason: "The same grape in sunny Napa: ripe, generous orchard and tropical fruit.",
    },
    source: "general",
  },
];
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/content/learn`
Expected: all PASS. If a dataset case fails with "pick not found", compare the name against the CSV with `python -c "import csv; [print(repr(r['winery']), repr(r['name']), repr(r['vintage'])) for r in csv.DictReader(open('../data/cleaned/wines_combined_200_currency_audited.csv', encoding='utf-8')) if 'Fèvre' in r['name']]"` and fix the content string, not the test.

- [ ] **Step 7: Commit**

```bash
git add src/content/learn
git commit -m "feat(learn): add How to Taste copy and example wine picks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `useActiveChapter` + `ChapterNav` + `ChapterSection`

**Files:**
- Create: `src/hooks/useActiveChapter.ts`, `src/hooks/useActiveChapter.test.tsx`
- Create: `src/components/learn/ChapterNav.tsx`, `src/components/learn/ChapterNav.test.tsx`
- Create: `src/components/learn/ChapterSection.tsx`

**Interfaces:**
- Consumes: `stubIntersectionObserver` from `src/test/stubs.ts` (tests only).
- Produces:
  - `export function useActiveChapter(ids: readonly string[]): string | undefined` — starts at `ids[0]`; updates to the id of an intersecting observed element.
  - `export interface ChapterLink { id: string; label: string }` and `export function ChapterNav({ chapters }: { chapters: readonly ChapterLink[] })` — `null` when `chapters.length < 2`.
  - `export function ChapterSection(props: { id: string; index: number; label: string; title: string; lead: string; children: ReactNode })` — renders `<section id aria-labelledby={`${id}-title`}>` with label `"01 · How to Taste"`, `<h2 id={`${id}-title`}>`, lead `<p>`, then children.

- [ ] **Step 1: Write the failing hook test** — `src/hooks/useActiveChapter.test.tsx`

The shared `fire()` helper builds entries without a `target`, so these tests call the observer callback directly.

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useActiveChapter } from "./useActiveChapter";
import { stubIntersectionObserver } from "../test/stubs";

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

describe("useActiveChapter", () => {
  it("starts on the first chapter and follows the intersecting one", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
    expect(instances[0].observe).toHaveBeenCalledTimes(2);

    act(() => {
      instances[0].callback(
        [{ isIntersecting: true, target: document.getElementById("vine")! } as unknown as IntersectionObserverEntry],
        instances[0] as unknown as IntersectionObserver
      );
    });
    expect(screen.getByTestId("active")).toHaveTextContent("vine");
  });

  it("ignores entries that are leaving view", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    act(() => {
      instances[0].callback(
        [{ isIntersecting: false, target: document.getElementById("vine")! } as unknown as IntersectionObserverEntry],
        instances[0] as unknown as IntersectionObserver
      );
    });
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });

  it("stays on the first chapter without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });
});
```

- [ ] **Step 2: Write the failing nav test** — `src/components/learn/ChapterNav.test.tsx`

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChapterNav } from "./ChapterNav";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChapterNav", () => {
  it("renders nothing with a single chapter", () => {
    const { container } = render(<ChapterNav chapters={[{ id: "taste", label: "How to Taste" }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an anchor per chapter and marks the active one", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <ChapterNav
        chapters={[
          { id: "taste", label: "How to Taste" },
          { id: "vine", label: "Vine to Glass" },
        ]}
      />
    );
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(nav).toBeInTheDocument();
    const taste = screen.getByRole("link", { name: "How to Taste" });
    const vine = screen.getByRole("link", { name: "Vine to Glass" });
    expect(taste).toHaveAttribute("href", "#taste");
    expect(vine).toHaveAttribute("href", "#vine");
    expect(taste).toHaveAttribute("aria-current", "true");
    expect(vine).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/hooks/useActiveChapter.test.tsx src/components/learn/ChapterNav.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement** — `src/hooks/useActiveChapter.ts`

```ts
import { useEffect, useState } from "react";

// A chapter counts as "current" while it crosses a band just below the sticky nav.
const ACTIVE_BAND = "-20% 0px -70% 0px";

export function useActiveChapter(ids: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  // Joined so a new array with the same ids doesn't re-subscribe every render.
  const key = ids.join("|");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries.find((entry) => entry.isIntersecting);
        if (entering) setActive(entering.target.id);
      },
      { rootMargin: ACTIVE_BAND }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [key]);

  return active;
}
```

- [ ] **Step 5: Implement** — `src/components/learn/ChapterNav.tsx`

```tsx
import { useActiveChapter } from "../../hooks/useActiveChapter";

export interface ChapterLink {
  id: string;
  label: string;
}

export function ChapterNav({ chapters }: { chapters: readonly ChapterLink[] }) {
  const active = useActiveChapter(chapters.map((chapter) => chapter.id));
  // A one-item bar is noise; it appears once a second chapter ships.
  if (chapters.length < 2) return null;

  return (
    <nav aria-label="Learn chapters" className="sticky top-0 z-10 -mx-4 px-4 bg-surface border-b border-surface-border">
      <ul className="flex gap-6 overflow-x-auto py-3 text-sm whitespace-nowrap">
        {chapters.map((chapter) => {
          const isActive = chapter.id === active;
          return (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`pb-1 border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  isActive ? "border-accent text-accent" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {chapter.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Implement** — `src/components/learn/ChapterSection.tsx`

`scroll-mt-16` keeps an anchored chapter's header clear of the sticky nav.

```tsx
import type { ReactNode } from "react";

interface ChapterSectionProps {
  id: string;
  index: number;
  label: string;
  title: string;
  lead: string;
  children: ReactNode;
}

export function ChapterSection({ id, index, label, title, lead, children }: ChapterSectionProps) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-16 py-12 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">
          {String(index).padStart(2, "0")} · {label}
        </p>
        <h2 id={titleId} className="font-serif text-3xl md:text-4xl text-ink mb-4">
          {title}
        </h2>
        <p className="text-ink-muted">{lead}</p>
      </header>
      {children}
    </section>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/useActiveChapter.test.tsx src/components/learn/ChapterNav.test.tsx`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useActiveChapter.ts src/hooks/useActiveChapter.test.tsx src/components/learn/ChapterNav.tsx src/components/learn/ChapterNav.test.tsx src/components/learn/ChapterSection.tsx
git commit -m "feat(learn): add chapter nav, active-chapter tracking, and chapter sections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `DimensionScale` + `ExampleWineCard`

**Files:**
- Create: `src/components/learn/taste/DimensionScale.tsx`, `src/components/learn/taste/DimensionScale.test.tsx`
- Create: `src/components/learn/taste/ExampleWineCard.tsx`, `src/components/learn/taste/ExampleWineCard.test.tsx`

**Interfaces:**
- Consumes: `DIMENSION_LABELS`, `DIMENSION_TITLES`, `type Dimension` from `src/utils/dimensionLabels.ts`; `WineImage` from `src/components/wine/WineImage.tsx`; `Skeleton` from `src/components/common/Skeleton.tsx`; `type WineListItem` from `src/types/wine.ts`.
- Produces:
  - `export type PairTone = "low" | "high";`
  - `export interface ScaleMarker { score: number; name: string; tone: PairTone }`
  - `export function DimensionScale({ dimension, markers }: { dimension: Dimension; markers: readonly ScaleMarker[] })`
  - `export function ExampleWineCard({ wine, dimension, tone, reason }: { wine: WineListItem; dimension: Dimension; tone: PairTone; reason: string })`
  - `export function ExampleWineCardSkeleton()`

- [ ] **Step 1: Write the failing scale test** — `src/components/learn/taste/DimensionScale.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DimensionScale } from "./DimensionScale";
import { DIMENSION_LABELS } from "../../../utils/dimensionLabels";

describe("DimensionScale", () => {
  it("lists the five Discover labels in order", () => {
    render(<DimensionScale dimension="tannin" markers={[]} />);
    const list = screen.getByRole("list", { name: "Tannin scale, 1 to 5" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(
      [1, 2, 3, 4, 5].map((step) => expect.stringContaining(DIMENSION_LABELS.tannin[step]))
    );
  });

  it("marks example wines at their scores", () => {
    render(
      <DimensionScale
        dimension="tannin"
        markers={[
          { score: 2, name: "Light Red", tone: "low" },
          { score: 5, name: "Big Red", tone: "high" },
        ]}
      />
    );
    const items = within(screen.getByRole("list", { name: "Tannin scale, 1 to 5" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Example: Light Red");
    expect(items[4]).toHaveTextContent("Example: Big Red");
    expect(items[0]).not.toHaveTextContent("Example:");
  });
});
```

- [ ] **Step 2: Write the failing card test** — `src/components/learn/taste/ExampleWineCard.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExampleWineCard, ExampleWineCardSkeleton } from "./ExampleWineCard";
import type { WineListItem } from "../../../types/wine";

const WINE: WineListItem = {
  id: 42,
  name: "Vietti Barolo Castiglione",
  winery: "Vietti",
  vintage: 2020,
  type: "red",
  country: "Italy",
  region: "Piedmont",
  grapes: [{ name: "Nebbiolo", percentage: null }],
  price: 55,
  currency: "USD",
  price_usd_approx: 55,
  image_url: "/wines/vietti.webp",
  sweetness: 1,
  acidity: 5,
  tannin: 5,
  body: 4,
  fruitiness: 3,
};

describe("ExampleWineCard", () => {
  it("links to the wine and shows its real score and the reason", () => {
    render(
      <MemoryRouter>
        <ExampleWineCard wine={WINE} dimension="tannin" tone="high" reason="Famous for its grip." />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /Vietti Barolo Castiglione/ });
    expect(link).toHaveAttribute("href", "/wines/42");
    expect(link).toHaveTextContent("High");
    expect(link).toHaveTextContent("red · Italy");
    expect(link).toHaveTextContent("Tannin 5 / 5");
    expect(link).toHaveTextContent("Famous for its grip.");
  });

  it("renders a skeleton placeholder", () => {
    render(<ExampleWineCardSkeleton />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/components/learn/taste`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement** — `src/components/learn/taste/DimensionScale.tsx`

```tsx
import { DIMENSION_LABELS, DIMENSION_TITLES, type Dimension } from "../../../utils/dimensionLabels";

export type PairTone = "low" | "high";

export interface ScaleMarker {
  score: number;
  name: string;
  tone: PairTone;
}

const STEPS = [1, 2, 3, 4, 5] as const;

export function DimensionScale({ dimension, markers }: { dimension: Dimension; markers: readonly ScaleMarker[] }) {
  return (
    <ol aria-label={`${DIMENSION_TITLES[dimension]} scale, 1 to 5`} className="grid grid-cols-5 gap-1 my-6">
      {STEPS.map((step) => {
        const here = markers.filter((marker) => marker.score === step);
        return (
          <li key={step} className="flex flex-col items-center text-center">
            <span className={`h-1.5 w-full rounded-full ${here.length > 0 ? "bg-accent" : "bg-surface-border"}`} />
            <span className="mt-2 text-sm text-ink">{step}</span>
            <span className="text-[11px] leading-tight text-ink-muted">{DIMENSION_LABELS[dimension][step]}</span>
            {here.map((marker) => (
              <span key={marker.name} className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                <span className="sr-only">Example: {marker.name}</span>
                <span aria-hidden="true">{marker.tone === "low" ? "Low" : "High"}</span>
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 5: Implement** — `src/components/learn/taste/ExampleWineCard.tsx`

```tsx
import { Link } from "react-router-dom";
import { Skeleton } from "../../common/Skeleton";
import { WineImage } from "../../wine/WineImage";
import type { WineListItem } from "../../../types/wine";
import { DIMENSION_TITLES, type Dimension } from "../../../utils/dimensionLabels";
import type { PairTone } from "./DimensionScale";

interface ExampleWineCardProps {
  wine: WineListItem;
  dimension: Dimension;
  tone: PairTone;
  reason: string;
}

export function ExampleWineCard({ wine, dimension, tone, reason }: ExampleWineCardProps) {
  return (
    <Link
      to={`/wines/${wine.id}`}
      className="flex gap-3 rounded border border-surface-border p-3 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <WineImage src={wine.image_url} alt="" className="h-24 w-16 shrink-0 rounded" />
      <span className="min-w-0">
        <span className="block text-xs uppercase tracking-wide text-accent">{tone === "low" ? "Low" : "High"}</span>
        <span className="block font-serif text-ink">{wine.name}</span>
        <span className="block text-sm text-ink-muted">
          {wine.type}
          {wine.country ? ` · ${wine.country}` : ""}
        </span>
        <span className="block text-sm text-ink">
          {DIMENSION_TITLES[dimension]} {wine[dimension] ?? "–"} / 5
        </span>
        <span className="block text-sm text-ink-muted mt-1">{reason}</span>
      </span>
    </Link>
  );
}

export function ExampleWineCardSkeleton() {
  return (
    <div className="flex gap-3 rounded border border-surface-border p-3">
      <Skeleton className="h-24 w-16 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/learn/taste`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/learn/taste/DimensionScale.tsx src/components/learn/taste/DimensionScale.test.tsx src/components/learn/taste/ExampleWineCard.tsx src/components/learn/taste/ExampleWineCard.test.tsx
git commit -m "feat(learn): add dimension scale and example wine card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dimension line art + `learn.css`

**Files:**
- Create: `src/components/learn/learn.css`
- Create: `src/components/learn/taste/art/SweetnessArt.tsx`, `AcidityArt.tsx`, `TanninArt.tsx`, `BodyArt.tsx`, `FruitArt.tsx`
- Create: `src/components/learn/taste/art/index.ts`
- Create: `src/components/learn/taste/art/art.test.tsx`

**Interfaces:**
- Consumes: `Glass` from `src/components/home/art/Glass.tsx`; `cssVars` from `src/components/home/art/cssVars.ts`; `DIMENSIONS`, `type Dimension`.
- Produces: `export const DIMENSION_ART: Record<Dimension, () => JSX.Element>` from `art/index.ts`. Each art component renders one `<svg focusable="false">` using the classes `draw` (with `pathLength={1}`), `pop`, `drip`, `fill-up`.

Art uses the home reveal classes: `.draw` (stroke draws in), `.pop` (fades/rises in). This task adds two Learn-only actions in `learn.css`: `.drip` (a hanging droplet falls twice, then re-forms) and `.fill-up` (a fill rises from the bottom).

- [ ] **Step 1: Write the failing test** — `src/components/learn/taste/art/art.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DIMENSION_ART } from ".";
import { DIMENSIONS } from "../../../../utils/dimensionLabels";

describe("DIMENSION_ART", () => {
  it("has art for every dimension", () => {
    expect(Object.keys(DIMENSION_ART).sort()).toEqual([...DIMENSIONS].sort());
  });

  it.each([...DIMENSIONS])("%s renders one unfocusable svg with drawn strokes", (dimension) => {
    const Art = DIMENSION_ART[dimension];
    const { container } = render(<Art />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute("focusable", "false");
    expect(container.querySelectorAll(".draw").length).toBeGreaterThan(0);
    for (const stroke of container.querySelectorAll(".draw")) {
      expect(stroke).toHaveAttribute("pathLength", "1");
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/taste/art`
Expected: FAIL — cannot resolve `.`.

- [ ] **Step 3: Implement** — `src/components/learn/learn.css`

```css
/*
 * Learn-only art actions. Same contract as components/home/home.css: every
 * rule outside `.scene-animate:not(.is-visible)` is the finished look, so
 * reduced motion, no JS, and no IntersectionObserver show complete art.
 */

.scene .drip,
.scene .fill-up {
  transform-box: fill-box;
}

/* Resting: the droplet hangs under the cluster. On reveal it falls twice, re-forming each time. */
.scene-animate.is-visible .drip {
  animation: learn-drip 1.6s ease-in var(--delay, 0s) 2;
}

@keyframes learn-drip {
  0% {
    transform: none;
    opacity: 1;
  }
  70% {
    transform: translateY(var(--drip-y, 40px));
    opacity: 1;
  }
  71%,
  100% {
    transform: translateY(var(--drip-y, 40px));
    opacity: 0;
  }
}

.scene .fill-up {
  transform-origin: 50% 100%;
  transition: transform 1s ease var(--delay, 0s);
}

.scene-animate:not(.is-visible) .fill-up {
  transform: scaleY(0);
}

/* Chapter-nav anchor jumps glide, except under reduced motion. */
@media (prefers-reduced-motion: no-preference) {
  html:has(.learn-page) {
    scroll-behavior: smooth;
  }
}
```

- [ ] **Step 4: Implement** — `src/components/learn/taste/art/SweetnessArt.tsx`

A grape cluster above a small glass of white wine; a droplet falls from the cluster into the glass.

```tsx
import { Glass } from "../../../home/art/Glass";
import { cssVars } from "../../../home/art/cssVars";

const GRAPES: ReadonlyArray<readonly [x: number, y: number]> = [
  [84, 22],
  [100, 22],
  [116, 22],
  [92, 36],
  [108, 36],
  [100, 50],
];

export function SweetnessArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M100 14 V4 q8 -6 16 -2" fill="none" strokeWidth="1.4" />
      {GRAPES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.1 + i * 0.08}s` })}
          cx={x}
          cy={y}
          r="8"
          fill="none"
          strokeWidth="1.2"
        />
      ))}
      <path
        className="drip fill-wine-white"
        style={cssVars({ "--delay": "1.2s", "--drip-y": "44px" })}
        d="M100 62 q-5 8 0 12 q5 -4 0 -12 z"
      />
      <g transform="translate(30 70) scale(0.7)">
        <Glass wine="white" level="mid" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 5: Implement** — `src/components/learn/taste/art/AcidityArt.tsx`

A lemon wedge; mouth-watering droplets pop out above it.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const SEGMENT_ENDS: ReadonlyArray<readonly [x: number, y: number]> = [
  [58.4, 106],
  [76, 88.4],
  [100, 82],
  [124, 88.4],
  [141.6, 106],
];
const DROPS: ReadonlyArray<readonly [x: number, y: number]> = [
  [52, 62],
  [80, 44],
  [120, 44],
  [148, 62],
  [170, 92],
];

export function AcidityArt() {
  return (
    <svg viewBox="0 0 200 180" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M40 130 A60 60 0 0 1 160 130 Z" fill="none" strokeWidth="1.6" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.3s" })}
        d="M52 130 A48 48 0 0 1 148 130"
        fill="none"
        strokeWidth="1"
      />
      {SEGMENT_ENDS.map(([x, y], i) => (
        <path
          key={`${x}-${y}`}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.5 + i * 0.08}s` })}
          d={`M100 130 L${x} ${y}`}
          fill="none"
          strokeWidth="0.8"
        />
      ))}
      {DROPS.map(([x, y], i) => (
        <path
          key={`${x}-${y}`}
          className="pop stroke-accent"
          style={cssVars({ "--delay": `${1.2 + i * 0.12}s` })}
          d={`M${x} ${y} q-5 8 0 12 q5 -4 0 -12 z`}
          fill="none"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 6: Implement** — `src/components/learn/taste/art/TanninArt.tsx`

A cup of strong tea beside a grape skin and seeds; a drying ripple draws across a tongue outline.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const SEEDS: ReadonlyArray<readonly [x: number, y: number]> = [
  [160, 112],
  [178, 118],
  [168, 132],
];

export function TanninArt() {
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-xs mx-auto" focusable="false">
      <path
        className="pop fill-wine-red"
        style={cssVars({ "--delay": "0.9s" })}
        fillOpacity="0.55"
        d="M34 80 H106 V100 Q106 136 70 136 Q34 136 34 100 Z"
      />
      <path className="draw stroke-accent" pathLength={1} d="M30 70 H110 V100 Q110 140 70 140 Q30 140 30 100 Z" fill="none" strokeWidth="1.6" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.3s" })}
        d="M110 82 q20 0 20 16 q0 16 -20 16"
        fill="none"
        strokeWidth="1.4"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M20 150 H120" fill="none" strokeWidth="1.4" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.5s" })}
        d="M150 60 q30 -10 45 10 q-10 25 -40 20 q-12 -12 -5 -30 z"
        fill="none"
        strokeWidth="1.2"
      />
      {SEEDS.map(([x, y], i) => (
        <ellipse
          key={`${x}-${y}`}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.7 + i * 0.1}s` })}
          cx={x}
          cy={y}
          rx="4"
          ry="6"
          fill="none"
          strokeWidth="1"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.8s" })}
        d="M130 205 q0 -40 40 -40 q40 0 40 40"
        fill="none"
        strokeWidth="1.4"
      />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "1.4s" })}
        d="M142 195 q7 -6 14 0 t14 0 t14 0 t14 0"
        fill="none"
        strokeWidth="1"
      />
    </svg>
  );
}
```

- [ ] **Step 7: Implement** — `src/components/learn/taste/art/BodyArt.tsx`

Three tumblers (skim milk, whole milk, cream) whose fills rise higher and more opaque, left to right.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const GLASSES: ReadonlyArray<{ label: string; level: number; opacity: number }> = [
  { label: "Skim", level: 150, opacity: 0.35 },
  { label: "Whole", level: 120, opacity: 0.6 },
  { label: "Cream", level: 90, opacity: 0.9 },
];

export function BodyArt() {
  return (
    <svg viewBox="0 0 240 220" className="w-full max-w-sm mx-auto" focusable="false">
      {GLASSES.map(({ label, level, opacity }, i) => {
        const x = 20 + i * 75;
        return (
          <g key={label}>
            <rect
              className="fill-up fill-wine-white"
              style={cssVars({ "--delay": `${0.8 + i * 0.25}s` })}
              x={x + 9}
              y={level}
              width="42"
              height={188 - level}
              fillOpacity={opacity}
            />
            <path
              className="draw stroke-accent"
              pathLength={1}
              style={cssVars({ "--delay": `${i * 0.15}s` })}
              d={`M${x} 60 L${x + 8} 190 H${x + 52} L${x + 60} 60`}
              fill="none"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <text x={x + 30} y="208" textAnchor="middle" fontSize="10" className="fill-ink-muted">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 8: Implement** — `src/components/learn/taste/art/FruitArt.tsx`

A vine leaf and stem; berries pop in one by one, from a sparse few to a full cluster.

```tsx
import { cssVars } from "../../../home/art/cssVars";

const BERRIES: ReadonlyArray<readonly [x: number, y: number]> = [
  [110, 80],
  [92, 96],
  [128, 96],
  [110, 112],
  [74, 112],
  [146, 112],
  [92, 128],
  [128, 128],
  [110, 144],
  [100, 160],
  [120, 160],
  [110, 176],
];

export function FruitArt() {
  return (
    <svg viewBox="0 0 220 200" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M110 70 V40 q10 -14 30 -14" fill="none" strokeWidth="1.4" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.2s" })}
        d="M140 26 q20 -16 40 -6 q-4 22 -26 26 q-12 -4 -14 -20 z"
        fill="none"
        strokeWidth="1.2"
      />
      {BERRIES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="pop fill-wine-red stroke-accent"
          style={cssVars({ "--delay": `${0.5 + i * 0.12}s` })}
          cx={x}
          cy={y}
          r="9"
          fillOpacity="0.8"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 9: Implement** — `src/components/learn/taste/art/index.ts`

```ts
import type { Dimension } from "../../../../utils/dimensionLabels";
import { AcidityArt } from "./AcidityArt";
import { BodyArt } from "./BodyArt";
import { FruitArt } from "./FruitArt";
import { SweetnessArt } from "./SweetnessArt";
import { TanninArt } from "./TanninArt";

export const DIMENSION_ART: Record<Dimension, () => JSX.Element> = {
  sweetness: SweetnessArt,
  acidity: AcidityArt,
  tannin: TanninArt,
  body: BodyArt,
  fruitiness: FruitArt,
};
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run src/components/learn/taste/art`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/learn/learn.css src/components/learn/taste/art
git commit -m "feat(learn): add line art for the five taste dimensions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pair loading (`pairs.ts`)

**Files:**
- Create: `src/components/learn/taste/pairs.ts`
- Create: `src/components/learn/taste/pairs.test.ts`

**Interfaces:**
- Consumes: `listWines(params)` from `src/services/api.ts` (returns `{ total, items: WineListItem[] }`); `type WinePick` from `src/content/learn/taste.ts`; `type Dimension`.
- Produces:
  ```ts
  export type PairState =
    | { status: "loading" }
    | { status: "ready"; low: WineListItem; high: WineListItem }
    | { status: "hidden" };
  export function matchPick(pick: WinePick, items: readonly WineListItem[]): WineListItem | undefined;
  export function loadPair(dimension: Dimension, low: WinePick, high: WinePick): Promise<PairState>; // never rejects
  ```

- [ ] **Step 1: Write the failing test** — `src/components/learn/taste/pairs.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as api from "../../../services/api";
import type { WineListItem } from "../../../types/wine";
import { loadPair, matchPick } from "./pairs";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

function wine(overrides: Partial<WineListItem>): WineListItem {
  return {
    id: 1,
    name: "Test Wine",
    winery: "Test Winery",
    vintage: 2022,
    type: "red",
    country: "France",
    region: null,
    grapes: [],
    price: null,
    currency: null,
    price_usd_approx: null,
    image_url: null,
    sweetness: 1,
    acidity: 3,
    tannin: 2,
    body: 3,
    fruitiness: 3,
    ...overrides,
  };
}

const LOW = { winery: "Louis Jadot", name: "Louis Jadot Bourgogne Pinot Noir", vintage: 2022, reason: "Silky." };
const HIGH = { winery: "Vietti", name: "Vietti Barolo Castiglione", vintage: 2020, reason: "Grippy." };

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
});

describe("matchPick", () => {
  it("requires an exact winery, name and vintage match", () => {
    const exact = wine({ id: 7, winery: "Vietti", name: "Vietti Barolo Castiglione", vintage: 2020 });
    const otherVintage = wine({ id: 8, winery: "Vietti", name: "Vietti Barolo Castiglione", vintage: 2019 });
    const otherWinery = wine({ id: 9, winery: "Not Vietti", name: "Vietti Barolo Castiglione", vintage: 2020 });
    expect(matchPick(HIGH, [otherVintage, otherWinery, exact])).toBe(exact);
    expect(matchPick(HIGH, [otherVintage, otherWinery])).toBeUndefined();
  });

  it("matches non-vintage picks against null vintages", () => {
    const nv = wine({ winery: "Castello del Poggio", name: "Castello del Poggio Moscato", vintage: null });
    expect(matchPick({ winery: "Castello del Poggio", name: "Castello del Poggio Moscato", vintage: null, reason: "" }, [nv])).toBe(nv);
  });
});

describe("loadPair", () => {
  it("searches by name and returns both matched wines", async () => {
    const low = wine({ id: 1, winery: LOW.winery, name: LOW.name, vintage: 2022, tannin: 2 });
    const high = wine({ id: 2, winery: HIGH.winery, name: HIGH.name, vintage: 2020, tannin: 5 });
    vi.mocked(api.listWines).mockImplementation(async (params = {}) => ({
      total: 1,
      items: params.q === LOW.name ? [low] : [high],
    }));
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "ready", low, high });
    expect(api.listWines).toHaveBeenCalledWith({ q: LOW.name, limit: 10 });
    expect(api.listWines).toHaveBeenCalledWith({ q: HIGH.name, limit: 10 });
  });

  it("hides the pair when one pick has no exact match", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "hidden" });
  });

  it("hides the pair when a request fails", async () => {
    const low = wine({ winery: LOW.winery, name: LOW.name, vintage: 2022 });
    vi.mocked(api.listWines).mockImplementation(async (params = {}) => {
      if (params.q === HIGH.name) throw new Error("network");
      return { total: 1, items: [low] };
    });
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "hidden" });
  });

  it("hides the pair when a wine has no score for the dimension", async () => {
    const low = wine({ winery: LOW.winery, name: LOW.name, vintage: 2022, tannin: null });
    const high = wine({ winery: HIGH.winery, name: HIGH.name, vintage: 2020, tannin: 5 });
    vi.mocked(api.listWines).mockImplementation(async (params = {}) => ({
      total: 1,
      items: params.q === LOW.name ? [low] : [high],
    }));
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "hidden" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/taste/pairs.test.ts`
Expected: FAIL — cannot resolve `./pairs`.

- [ ] **Step 3: Implement** — `src/components/learn/taste/pairs.ts`

```ts
import { listWines } from "../../../services/api";
import type { WinePick } from "../../../content/learn/taste";
import type { WineListItem } from "../../../types/wine";
import type { Dimension } from "../../../utils/dimensionLabels";

export type PairState =
  | { status: "loading" }
  | { status: "ready"; low: WineListItem; high: WineListItem }
  | { status: "hidden" };

// Name search can return near-misses (other vintages, similarly named wines), so only an exact match counts.
const SEARCH_LIMIT = 10;

export function matchPick(pick: WinePick, items: readonly WineListItem[]): WineListItem | undefined {
  return items.find((item) => item.winery === pick.winery && item.name === pick.name && item.vintage === pick.vintage);
}

async function findPick(pick: WinePick): Promise<WineListItem> {
  const { items } = await listWines({ q: pick.name, limit: SEARCH_LIMIT });
  const match = matchPick(pick, items);
  if (!match) throw new Error(`No exact match for ${pick.name}`);
  return match;
}

/** Resolves both picks. Never rejects: any miss, failure, or missing score hides the pair. */
export async function loadPair(dimension: Dimension, low: WinePick, high: WinePick): Promise<PairState> {
  const [lowResult, highResult] = await Promise.allSettled([findPick(low), findPick(high)]);
  if (lowResult.status !== "fulfilled" || highResult.status !== "fulfilled") return { status: "hidden" };
  if (lowResult.value[dimension] === null || highResult.value[dimension] === null) return { status: "hidden" };
  return { status: "ready", low: lowResult.value, high: highResult.value };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/learn/taste/pairs.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/taste/pairs.ts src/components/learn/taste/pairs.test.ts
git commit -m "feat(learn): resolve example wine pairs by exact winery, name and vintage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `DimensionBlock` + `TasteChapter`

**Files:**
- Create: `src/components/learn/taste/DimensionBlock.tsx`, `src/components/learn/taste/DimensionBlock.test.tsx`
- Create: `src/components/learn/taste/TasteChapter.tsx`, `src/components/learn/taste/TasteChapter.test.tsx`

**Interfaces:**
- Consumes: `useReveal` (Task 1); `TASTE_DIMENSIONS`, `type TasteDimensionContent` (Task 2); `DimensionScale`, `type ScaleMarker`, `ExampleWineCard`, `ExampleWineCardSkeleton` (Task 4); `DIMENSION_ART` and `learn.css` (Task 5); `loadPair`, `type PairState` (Task 6); `DIMENSION_TITLES`; `components/home/home.css`.
- Produces:
  - `export function DimensionBlock({ content, pair, side }: { content: TasteDimensionContent; pair: PairState; side: "left" | "right" })` — renders `<article aria-labelledby={`taste-${dimension}-title`}>` with an `<h3>`.
  - `export function TasteChapter()` — the chapter body (no `<section>`; `ChapterSection` wraps it in Task 8).

- [ ] **Step 1: Write the failing block test** — `src/components/learn/taste/DimensionBlock.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DimensionBlock } from "./DimensionBlock";
import { TASTE_DIMENSIONS } from "../../../content/learn/taste";
import type { WineListItem } from "../../../types/wine";
import type { PairState } from "./pairs";

const TANNIN = TASTE_DIMENSIONS.find((entry) => entry.dimension === "tannin")!;

function wine(id: number, name: string, tannin: number): WineListItem {
  return {
    id,
    name,
    winery: "W",
    vintage: 2020,
    type: "red",
    country: "Italy",
    region: null,
    grapes: [],
    price: null,
    currency: null,
    price_usd_approx: null,
    image_url: null,
    sweetness: 1,
    acidity: 3,
    tannin,
    body: 3,
    fruitiness: 3,
  };
}

function renderBlock(pair: PairState, side: "left" | "right" = "left") {
  return render(
    <MemoryRouter>
      <DimensionBlock content={TANNIN} pair={pair} side={side} />
    </MemoryRouter>
  );
}

describe("DimensionBlock", () => {
  it("renders the heading, copy, and hidden art", () => {
    renderBlock({ status: "hidden" });
    const article = screen.getByRole("article", { name: "Tannin" });
    expect(within(article).getByRole("heading", { level: 3, name: "Tannin" })).toBeInTheDocument();
    expect(article).toHaveTextContent(TANNIN.what);
    expect(article).toHaveTextContent(TANNIN.feel);
    expect(article).toHaveTextContent(TANNIN.tip);
    expect(screen.getByTestId("dimension-art")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows skeletons while the pair loads", () => {
    renderBlock({ status: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent("Loading example wines");
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("shows both wines with links, real scores, and scale markers when ready", () => {
    renderBlock({ status: "ready", low: wine(3, "Light Red", 2), high: wine(4, "Big Red", 5) });
    const examples = screen.getByRole("list", { name: "Example wines" });
    const links = within(examples).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/wines/3");
    expect(links[0]).toHaveTextContent("Tannin 2 / 5");
    expect(links[0]).toHaveTextContent(TANNIN.low.reason);
    expect(links[1]).toHaveAttribute("href", "/wines/4");
    expect(links[1]).toHaveTextContent("Tannin 5 / 5");
    const scale = screen.getByRole("list", { name: "Tannin scale, 1 to 5" });
    expect(scale).toHaveTextContent("Example: Light Red");
    expect(scale).toHaveTextContent("Example: Big Red");
  });

  it("drops the pair but keeps the scale when hidden", () => {
    renderBlock({ status: "hidden" });
    expect(screen.queryByRole("list", { name: "Example wines" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Tannin scale, 1 to 5" })).not.toHaveTextContent("Example:");
  });

  it("moves the art to the right column only for right-side blocks", () => {
    const { unmount } = renderBlock({ status: "hidden" }, "right");
    expect(screen.getByTestId("dimension-art")).toHaveClass("md:order-last");
    unmount();
    renderBlock({ status: "hidden" }, "left");
    expect(screen.getByTestId("dimension-art")).not.toHaveClass("md:order-last");
  });
});
```

- [ ] **Step 2: Write the failing chapter test** — `src/components/learn/taste/TasteChapter.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import { TASTE_DIMENSIONS } from "../../../content/learn/taste";
import type { WineListItem } from "../../../types/wine";
import { TasteChapter } from "./TasteChapter";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

// Every pick resolves to an exact match with a distinct id; the tannin high pick is missing.
const PICKS = TASTE_DIMENSIONS.flatMap((entry) => [
  { pick: entry.low, dimension: entry.dimension, score: 1 },
  { pick: entry.high, dimension: entry.dimension, score: 5 },
]);
const TANNIN_HIGH = TASTE_DIMENSIONS.find((entry) => entry.dimension === "tannin")!.high;

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
  vi.mocked(api.listWines).mockImplementation(async (params = {}) => {
    if (params.q === TANNIN_HIGH.name) return { total: 0, items: [] };
    const index = PICKS.findIndex(({ pick }) => pick.name === params.q);
    const { pick, dimension, score } = PICKS[index];
    const item: WineListItem = {
      id: 100 + index,
      name: pick.name,
      winery: pick.winery,
      vintage: pick.vintage,
      type: "white",
      country: "France",
      region: null,
      grapes: [],
      price: null,
      currency: null,
      price_usd_approx: null,
      image_url: null,
      sweetness: 3,
      acidity: 3,
      tannin: 3,
      body: 3,
      fruitiness: 3,
      [dimension]: score,
    };
    return { total: 1, items: [item] };
  });
});

function renderChapter() {
  render(
    <MemoryRouter>
      <TasteChapter />
    </MemoryRouter>
  );
}

describe("TasteChapter", () => {
  it("renders one block per dimension in order", () => {
    renderChapter();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Sweetness",
      "Acidity",
      "Tannin",
      "Body",
      "Fruit Intensity",
    ]);
  });

  it("loads each pair and hides only the pair whose pick has no match", async () => {
    renderChapter();
    expect(await screen.findAllByRole("list", { name: "Example wines" })).toHaveLength(4);
    const tannin = screen.getByRole("article", { name: "Tannin" });
    expect(tannin.querySelector('[aria-label="Example wines"]')).toBeNull();
    expect(tannin).toHaveTextContent(TASTE_DIMENSIONS.find((entry) => entry.dimension === "tannin")!.what);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/components/learn/taste/DimensionBlock.test.tsx src/components/learn/taste/TasteChapter.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement** — `src/components/learn/taste/DimensionBlock.tsx`

```tsx
import { useRef } from "react";
import { useReveal } from "../../../hooks/useReveal";
import type { TasteDimensionContent } from "../../../content/learn/taste";
import { DIMENSION_TITLES } from "../../../utils/dimensionLabels";
import { DIMENSION_ART } from "./art";
import { DimensionScale, type ScaleMarker } from "./DimensionScale";
import { ExampleWineCard, ExampleWineCardSkeleton } from "./ExampleWineCard";
import type { PairState } from "./pairs";
import "../../home/home.css";
import "../learn.css";

interface DimensionBlockProps {
  content: TasteDimensionContent;
  pair: PairState;
  side: "left" | "right";
}

function markersFor(content: TasteDimensionContent, pair: PairState): ScaleMarker[] {
  if (pair.status !== "ready") return [];
  const { dimension } = content;
  return [
    { score: pair.low[dimension] ?? 0, name: pair.low.name, tone: "low" },
    { score: pair.high[dimension] ?? 0, name: pair.high.name, tone: "high" },
  ];
}

function Pair({ content, pair }: { content: TasteDimensionContent; pair: PairState }) {
  if (pair.status === "hidden") return null;
  if (pair.status === "loading") {
    return (
      <>
        <p role="status" className="sr-only">
          Loading example wines…
        </p>
        <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
          <ExampleWineCardSkeleton />
          <ExampleWineCardSkeleton />
        </div>
      </>
    );
  }
  return (
    <ul aria-label="Example wines" className="grid gap-3 sm:grid-cols-2">
      <li>
        <ExampleWineCard wine={pair.low} dimension={content.dimension} tone="low" reason={content.low.reason} />
      </li>
      <li>
        <ExampleWineCard wine={pair.high} dimension={content.dimension} tone="high" reason={content.high.reason} />
      </li>
    </ul>
  );
}

export function DimensionBlock({ content, pair, side }: DimensionBlockProps) {
  const ref = useRef<HTMLElement>(null);
  const reveal = useReveal(ref);
  const titleId = `taste-${content.dimension}-title`;
  const Art = DIMENSION_ART[content.dimension];
  const classes = ["scene grid items-center gap-10 py-12 md:grid-cols-2", ...reveal];

  return (
    <article ref={ref} aria-labelledby={titleId} className={classes.join(" ")}>
      <div data-testid="dimension-art" aria-hidden="true" className={side === "right" ? "md:order-last" : undefined}>
        <Art />
      </div>
      <div>
        <h3 id={titleId} className="font-serif text-2xl text-ink mb-4">
          {DIMENSION_TITLES[content.dimension]}
        </h3>
        <dl className="grid gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">What it is</dt>
            <dd className="text-ink">{content.what}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">How it feels</dt>
            <dd className="text-ink">{content.feel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Try this</dt>
            <dd className="text-ink-muted">{content.tip}</dd>
          </div>
        </dl>
        <DimensionScale dimension={content.dimension} markers={markersFor(content, pair)} />
        <Pair content={content} pair={pair} />
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Implement** — `src/components/learn/taste/TasteChapter.tsx`

```tsx
import { useEffect, useState } from "react";
import { TASTE_DIMENSIONS } from "../../../content/learn/taste";
import type { Dimension } from "../../../utils/dimensionLabels";
import { DimensionBlock } from "./DimensionBlock";
import { loadPair, type PairState } from "./pairs";

type Pairs = Partial<Record<Dimension, PairState>>;

const LOADING: PairState = { status: "loading" };

export function TasteChapter() {
  const [pairs, setPairs] = useState<Pairs>({});

  useEffect(() => {
    let active = true;
    for (const { dimension, low, high } of TASTE_DIMENSIONS) {
      loadPair(dimension, low, high).then((state) => {
        if (active) setPairs((previous) => ({ ...previous, [dimension]: state }));
      });
    }
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mt-4">
      {TASTE_DIMENSIONS.map((content, i) => (
        <DimensionBlock
          key={content.dimension}
          content={content}
          pair={pairs[content.dimension] ?? LOADING}
          side={i % 2 === 0 ? "left" : "right"}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/learn`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/learn/taste/DimensionBlock.tsx src/components/learn/taste/DimensionBlock.test.tsx src/components/learn/taste/TasteChapter.tsx src/components/learn/taste/TasteChapter.test.tsx
git commit -m "feat(learn): add dimension blocks and the How to Taste chapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `LearnPage`, chapter list, routing, stub removal

**Files:**
- Create: `src/components/learn/LearnIntro.tsx`
- Create: `src/components/learn/chapters.ts`
- Create: `src/pages/LearnPage.tsx`, `src/pages/LearnPage.test.tsx`
- Modify: `src/App.tsx:10` (import), `src/App.test.tsx` (Learn route test)
- Delete: `src/pages/StubPages.tsx`, `src/components/common/StubPage.tsx`

**Interfaces:**
- Consumes: `ChapterNav`, `ChapterSection` (Task 3); `TASTE_CHAPTER` (Task 2); `TasteChapter` (Task 7); `useReveal` (Task 1); `usePrefersReducedMotion`; `cssVars`.
- Produces:
  - `export interface LearnChapter { id: string; label: string; title: string; lead: string; Component: () => JSX.Element }`
  - `export const LEARN_CHAPTERS: readonly LearnChapter[]` — currently `[taste]`.
  - `export function LearnPage()` from `src/pages/LearnPage.tsx`.

- [ ] **Step 1: Write the failing page test** — `src/pages/LearnPage.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../services/api";
import { LearnPage } from "./LearnPage";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <LearnPage />
    </MemoryRouter>
  );
}

describe("LearnPage", () => {
  it("renders the intro and the How to Taste chapter", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { level: 1, name: "Learn what's in your glass." })).toBeInTheDocument();
    const chapter = screen.getByRole("region", { name: "Five things your mouth is measuring" });
    expect(chapter).toHaveAttribute("id", "taste");
    expect(screen.getByText("01 · How to Taste")).toBeInTheDocument();
  });

  it("hides the chapter nav while there is only one chapter", () => {
    renderAt("/learn");
    expect(screen.queryByRole("navigation", { name: "Learn chapters" })).not.toBeInTheDocument();
  });

  it("scrolls a #hash chapter into view on arrival", () => {
    renderAt("/learn#taste");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("taste"));
  });

  it("does not scroll without a hash", () => {
    renderAt("/learn");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Update the App route test** — in `src/App.test.tsx`, replace the `"renders the Learn stub page at /learn"` test with:

```tsx
  it("renders the Learn page at /learn", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { level: 1, name: "Learn what's in your glass." })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/App.test.tsx`
Expected: FAIL — `./LearnPage` not found; App test can't find the new heading.

- [ ] **Step 4: Implement** — `src/components/learn/LearnIntro.tsx`

```tsx
import { useRef } from "react";
import { useReveal } from "../../hooks/useReveal";
import { cssVars } from "../home/art/cssVars";
import "../home/home.css";

function Flourish() {
  return (
    <svg viewBox="0 0 240 40" className="w-48 mb-6" focusable="false" aria-hidden="true">
      <path
        className="draw stroke-accent"
        pathLength={1}
        d="M4 20 H96 q12 -14 24 0 q12 14 24 0 H236"
        fill="none"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle className="pop fill-wine-rose" style={cssVars({ "--delay": "0.9s" })} cx="120" cy="20" r="3" />
    </svg>
  );
}

export function LearnIntro() {
  const ref = useRef<HTMLElement>(null);
  const reveal = useReveal(ref);
  return (
    <header ref={ref} className={["scene pt-8 pb-10 max-w-2xl", ...reveal].join(" ")}>
      <Flourish />
      <h1 className="font-serif text-4xl md:text-5xl text-ink mb-4">Learn what's in your glass.</h1>
      <p className="text-ink-muted text-lg">
        A short guide to the words behind the wine, starting with how to taste. Every term here is one you'll meet across
        VinoScope.
      </p>
    </header>
  );
}
```

- [ ] **Step 5: Implement** — `src/components/learn/chapters.ts`

```ts
import { TASTE_CHAPTER } from "../../content/learn/taste";
import { TasteChapter } from "./taste/TasteChapter";

export interface LearnChapter {
  id: string;
  label: string;
  title: string;
  lead: string;
  Component: () => JSX.Element;
}

// Drives both the chapter nav and the page sections. Add later parts here, in reading order.
export const LEARN_CHAPTERS: readonly LearnChapter[] = [
  {
    id: TASTE_CHAPTER.id,
    label: TASTE_CHAPTER.label,
    title: TASTE_CHAPTER.title,
    lead: TASTE_CHAPTER.lead,
    Component: TasteChapter,
  },
];
```

- [ ] **Step 6: Implement** — `src/pages/LearnPage.tsx`

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChapterNav } from "../components/learn/ChapterNav";
import { ChapterSection } from "../components/learn/ChapterSection";
import { LEARN_CHAPTERS } from "../components/learn/chapters";
import { LearnIntro } from "../components/learn/LearnIntro";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import "../components/learn/learn.css";

export function LearnPage() {
  const { hash } = useLocation();
  const reducedMotion = usePrefersReducedMotion();

  // Only on arrival: the chapter doesn't exist yet when the browser tries its own
  // hash scroll. Later hash changes come from in-page anchors, which scroll natively.
  useEffect(() => {
    if (!hash) return;
    document
      .getElementById(decodeURIComponent(hash.slice(1)))
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, []);

  return (
    <div className="learn-page">
      <LearnIntro />
      <ChapterNav chapters={LEARN_CHAPTERS} />
      {LEARN_CHAPTERS.map(({ id, label, title, lead, Component }, i) => (
        <ChapterSection key={id} id={id} index={i + 1} label={label} title={title} lead={lead}>
          <Component />
        </ChapterSection>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Route to the real page and delete the stubs**

In `src/App.tsx`, change line 10:

```tsx
import { LearnPage } from "./pages/LearnPage";
```

Then delete the stubs (Learn was their only user — confirm with `grep -rn "StubPage" src` returning nothing after the import change, before deleting):

```bash
git rm src/pages/StubPages.tsx src/components/common/StubPage.tsx
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/App.test.tsx`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/learn/LearnIntro.tsx src/components/learn/chapters.ts src/pages/LearnPage.tsx src/pages/LearnPage.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat(learn): replace the Learn stub with the chaptered Learn page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Home Learn scene copy + full verification

**Files:**
- Modify: `src/components/home/scenes/LearnScene.tsx` (the `<p>` copy)
- Modify: `src/components/home/scenes/FeatureScenes.test.tsx:61-66` (the `LearnScene` describe block)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Update the failing test first** — in `FeatureScenes.test.tsx`, replace the `LearnScene` describe block with:

```tsx
describe("LearnScene", () => {
  it("describes the How to Taste guide", () => {
    renderScene(LearnScene);
    expect(screen.getByText(/five things your mouth is measuring/i)).toBeInTheDocument();
    expect(screen.queryByText(/being poured now/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/home/scenes/FeatureScenes.test.tsx`
Expected: FAIL — copy not found.

- [ ] **Step 3: Update the copy** — in `LearnScene.tsx`, replace the paragraph text:

```tsx
      <p className="text-ink-muted mb-6">
        Start with the five things your mouth is measuring — sweetness, acidity, tannin, body and fruit — each with
        real wines from the catalog to taste the difference.
      </p>
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/home/scenes/FeatureScenes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite and build**

Run: `npx vitest run`
Expected: every file passes (51 baseline files + the new Learn files; no failures).

Run: `npm run build`
Expected: `tsc -b` reports no errors and Vite builds successfully.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/scenes/LearnScene.tsx src/components/home/scenes/FeatureScenes.test.tsx
git commit -m "feat(home): point the Learn scene at the How to Taste guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Visual check in the running app**

Start the stack (backend + `npm run dev`) and open `/learn` and `/learn#taste` in a desktop and a phone-width viewport, in each theme. Confirm: art draws in as each block enters view; blocks alternate sides on desktop and stack on phones; all five pairs show real wines with bottle images and correct scores; with OS reduced motion on, everything renders in its finished state immediately. Note any art that needs position tweaks and fix it in a follow-up commit.
