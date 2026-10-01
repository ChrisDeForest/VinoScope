# Learn Page, Part 3: Key Grapes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Key Grapes chapter to `/learn`: a seven-grape picker (accessible tabs) above one detail panel with line art, copy, a five-scale textbook profile, and an Explore link with a live catalog count, deep-linkable via `#grape-<slug>`.

**Architecture:** Static content in `content/learn/grapes.ts` feeds `GrapesChapter`, which owns the selected grape (seeded from the router hash, written back with a replace navigation) and renders `GrapePicker` (tablist) and a keyed `GrapePanel` (tabpanel) composed of `GrapeArt`, `ProfileBars`, and `GrapeExploreLink` (`listWines({ grape, limit: 1 }).total`). The chapter is appended to `LEARN_CHAPTERS`; `LearnPage`'s existing arrival scroll handles `#grape-<slug>`.

**Tech Stack:** React 18, TypeScript, React Router 6, Tailwind 3, Vitest 2 + Testing Library (jsdom), `@testing-library/user-event`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-01-learn-key-grapes-design.md`

## Global Constraints

- All paths are relative to `frontend/` unless they start with `docs/` or `data/`.
- Run tests from `frontend/`: `npx vitest run <path>`; full suite `npx vitest run`; type-check + build `npm run build`. Baseline on `main`: 68 files, 482 tests, all passing.
- Test-first for every task: failing test, watch it fail, implement, watch it pass, commit.
- No new npm dependencies. No backend changes.
- CSS rules outside `.scene-animate:not(.is-visible)` describe the finished look; only `transform`, `opacity`, `stroke-dashoffset` animate.
- Line art: gold strokes via `stroke-accent`; wine colors (`fill-wine-red`, `fill-wine-white`) the only fills; art `aria-hidden="true"`; every `.draw` element has `pathLength={1}`.
- All Learn copy lives in `src/content/learn/`; every entry carries `source: "general" | "course"` (all new entries `"general"`); never shown on the page.
- Tailwind color tokens are plain CSS variables: opacity modifiers like `bg-accent/50` do NOT work. Use `opacity-50` on the element instead.
- Arrow glyphs (`→`) go in an `aria-hidden="true"` span so link names don't include them.
- Files contain non-ASCII (`é`, `è`, `→`, `—`). Save as UTF-8; after each commit verify touched files decode as UTF-8 (from the repo root: `git diff --name-only HEAD~1 | .venv/Scripts/python -c "import sys; [open(f,'rb').read().decode('utf-8') for f in sys.stdin.read().split()]; print('utf-8 ok')"`).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on branch `feature/learn-grapes` (the controller creates it before Task 1).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/test/dataset.ts` | Create | Shared CSV parser + parsed dataset rows for tests |
| `src/content/learn/taste.dataset.test.ts` | Modify | Use the shared parser |
| `src/content/learn/grapes.ts` (+ `grapes.test.ts`, `grapes.dataset.test.ts`) | Create | `GRAPES_CHAPTER`, `GRAPES`, types |
| `src/components/learn/grapes/ProfileBars.tsx` (+ test) | Create | Five segment rows |
| `src/components/learn/grapes/GrapeExploreLink.tsx` (+ test) | Create | Live-count Explore link |
| `src/components/learn/grapes/GrapePicker.tsx` (+ test) | Create | Tabs widget |
| `src/components/learn/grapes/GrapeArt.tsx`, `GrapePanel.tsx` (+ test) | Create | Cluster art; tabpanel |
| `src/components/learn/grapes/GrapesChapter.tsx` (+ test) | Create | Selection + hash |
| `src/components/learn/chapters.ts` | Modify | Append `grapes` |
| `src/pages/LearnPage.test.tsx` | Modify | Three chapters; `#grape-…` arrival |
| `src/components/home/scenes/LearnScene.tsx` (+ `FeatureScenes.test.tsx`) | Modify | Copy mentions grapes |

---

### Task 1: Grape content + shared dataset helper

**Files:**
- Create: `src/test/dataset.ts`
- Modify: `src/content/learn/taste.dataset.test.ts`
- Create: `src/content/learn/grapes.ts`, `src/content/learn/grapes.test.ts`, `src/content/learn/grapes.dataset.test.ts`

**Interfaces:**
- Consumes: `type Dimension`, `DIMENSIONS` from `src/utils/dimensionLabels.ts`; `type ContentSource` from `src/content/learn/types.ts`.
- Produces:
  ```ts
  // src/test/dataset.ts
  export function parseCsv(text: string): Record<string, string>[];
  export const DATASET_ROWS: Record<string, string>[];
  // src/content/learn/grapes.ts
  export type GrapeColor = "red" | "white";
  export type ProfileValue = number | readonly [number, number];
  export interface GrapeContent {
    id: string; name: string; color: GrapeColor; exploreGrape: string;
    tagline: string; about: string; notes: readonly string[];
    profile: Record<Dimension, ProfileValue>; regions: readonly string[];
    source: ContentSource;
  }
  export const GRAPES_CHAPTER: { id: "grapes"; label: string; title: string; lead: string; source: ContentSource };
  export const GRAPES: readonly GrapeContent[];
  export const DEFAULT_GRAPE_ID = "cabernet-sauvignon";
  ```

- [ ] **Step 1: Extract the shared helper** — create `src/test/dataset.ts` by moving the `parseCsv` function out of `src/content/learn/taste.dataset.test.ts` unchanged, then:

```ts
import csvText from "../../../data/cleaned/wines_combined_200_currency_audited.csv?raw";

// Minimal RFC 4180 parser: quoted fields may contain commas, newlines, and "" escapes.
export function parseCsv(text: string): Record<string, string>[] {
  // (body moved verbatim from taste.dataset.test.ts)
}

/** The cleaned dataset the importer loads, parsed once for data-checking tests. */
export const DATASET_ROWS = parseCsv(csvText);
```

In `taste.dataset.test.ts`, delete the `csvText` import, the local `parseCsv`, and `const rows = parseCsv(csvText);`; add `import { DATASET_ROWS as rows } from "../../test/dataset";`.

- [ ] **Step 2: Confirm the refactor is behavior-neutral**

Run: `npx vitest run src/content/learn/taste.dataset.test.ts`
Expected: PASS (same 6 tests as before).

- [ ] **Step 3: Write the failing content test** — `src/content/learn/grapes.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { DEFAULT_GRAPE_ID, GRAPES, GRAPES_CHAPTER } from "./grapes";

describe("Key Grapes content", () => {
  it("has chapter strings", () => {
    expect(GRAPES_CHAPTER.id).toBe("grapes");
    expect(GRAPES_CHAPTER.label).toBe("Key Grapes");
    expect(GRAPES_CHAPTER.title).toBe("Seven grapes to know");
    expect(GRAPES_CHAPTER.lead.trim()).not.toBe("");
  });

  it("lists the classic seven, reds then whites", () => {
    expect(GRAPES.map((grape) => grape.id)).toEqual([
      "cabernet-sauvignon",
      "merlot",
      "pinot-noir",
      "syrah",
      "chardonnay",
      "sauvignon-blanc",
      "riesling",
    ]);
    expect(GRAPES.map((grape) => grape.color)).toEqual(["red", "red", "red", "red", "white", "white", "white"]);
    expect(GRAPES[0].id).toBe(DEFAULT_GRAPE_ID);
  });

  it("uses unique, URL-safe slugs", () => {
    const ids = GRAPES.map((grape) => grape.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(GRAPES.map((grape) => [grape.id, grape] as const))("%s has copy, notes, regions and a source", (_id, grape) => {
    for (const text of [grape.name, grape.exploreGrape, grape.tagline, grape.about]) expect(text.trim()).not.toBe("");
    expect(grape.notes.length).toBeGreaterThanOrEqual(3);
    expect(grape.notes.length).toBeLessThanOrEqual(5);
    expect(grape.regions.length).toBeGreaterThanOrEqual(3);
    expect(grape.regions.length).toBeLessThanOrEqual(4);
    expect(["general", "course"]).toContain(grape.source);
  });

  it.each(GRAPES.map((grape) => [grape.id, grape] as const))("%s has a valid profile on all five scales", (_id, grape) => {
    expect(Object.keys(grape.profile).sort()).toEqual([...DIMENSIONS].sort());
    for (const value of Object.values(grape.profile)) {
      const [lo, hi] = typeof value === "number" ? [value, value] : value;
      for (const n of [lo, hi]) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(5);
      }
      expect(lo).toBeLessThanOrEqual(hi);
    }
  });

  it("uses ranges where the grape spans the scale", () => {
    expect(GRAPES.find((grape) => grape.id === "riesling")!.profile.sweetness).toEqual([1, 5]);
    expect(GRAPES.find((grape) => grape.id === "chardonnay")!.profile.body).toEqual([2, 4]);
  });
});
```

- [ ] **Step 4: Write the failing dataset test** — `src/content/learn/grapes.dataset.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { GRAPES } from "./grapes";

// Mirrors Explore's grape filter: a case-insensitive "contains" match against any grape in a wine.
function matches(grapeFilter: string) {
  const needle = grapeFilter.toLowerCase();
  return DATASET_ROWS.filter((row) =>
    row.grape
      .split(";")
      .map((grape) => grape.trim().toLowerCase())
      .some((grape) => grape.includes(needle))
  );
}

describe("Key Grapes against the dataset", () => {
  it.each(GRAPES.map((grape) => [grape.name, grape.exploreGrape] as const))(
    "%s has at least 3 catalog wines for its Explore link",
    (_name, exploreGrape) => {
      expect(matches(exploreGrape).length).toBeGreaterThanOrEqual(3);
    }
  );
});
```

- [ ] **Step 5: Run them to verify they fail**

Run: `npx vitest run src/content/learn/grapes.test.ts src/content/learn/grapes.dataset.test.ts`
Expected: FAIL — cannot resolve `./grapes`.

- [ ] **Step 6: Implement** — `src/content/learn/grapes.ts`

```ts
import type { Dimension } from "../../utils/dimensionLabels";
import type { ContentSource } from "./types";

export type GrapeColor = "red" | "white";
/** A typical score, or a [low, high] range for grapes that span the scale. */
export type ProfileValue = number | readonly [number, number];

export interface GrapeContent {
  /** URL-safe slug; also the deep-link anchor (`#grape-<id>`). */
  id: string;
  name: string;
  color: GrapeColor;
  /** Value for Explore's `grape` filter (a case-insensitive contains match). */
  exploreGrape: string;
  tagline: string;
  /** "What it's like". */
  about: string;
  /** "Tastes like". */
  notes: readonly string[];
  profile: Record<Dimension, ProfileValue>;
  /** "Where it shines". */
  regions: readonly string[];
  source: ContentSource;
}

export const GRAPES_CHAPTER = {
  id: "grapes",
  label: "Key Grapes",
  title: "Seven grapes to know",
  lead: "These seven grapes make many of the world's best-known wines. Pick one to see what it tastes like, where it grows best, and how to find it in the catalog.",
  source: "general",
} as const satisfies { id: "grapes"; label: string; title: string; lead: string; source: ContentSource };

export const DEFAULT_GRAPE_ID = "cabernet-sauvignon";

export const GRAPES: readonly GrapeContent[] = [
  {
    id: "cabernet-sauvignon",
    name: "Cabernet Sauvignon",
    color: "red",
    exploreGrape: "Cabernet Sauvignon",
    tagline: "The structured, age-worthy king of reds.",
    about: "Small, thick-skinned berries give Cabernet deep color, firm tannin and the backbone to age for decades. It loves warm, sunny, well-drained vineyards and leads most blends on Bordeaux's Left Bank.",
    notes: ["blackcurrant", "black cherry", "cedar", "mint"],
    profile: { sweetness: 1, acidity: 3, tannin: 5, body: 5, fruitiness: 4 },
    regions: ["Bordeaux (Left Bank)", "Napa Valley", "Coonawarra", "Chile"],
    source: "general",
  },
  {
    id: "merlot",
    name: "Merlot",
    color: "red",
    exploreGrape: "Merlot",
    tagline: "Cabernet's softer, plusher partner.",
    about: "Merlot ripens earlier than Cabernet and gives rounder, fleshier wines with gentler tannin. On Bordeaux's Right Bank it leads the blend; elsewhere it's often bottled on its own as an easygoing, fruit-forward red.",
    notes: ["plum", "black cherry", "cocoa"],
    profile: { sweetness: 1, acidity: 3, tannin: 3, body: 4, fruitiness: 4 },
    regions: ["Bordeaux (Right Bank: Pomerol, Saint-Émilion)", "Washington", "Napa Valley"],
    source: "general",
  },
  {
    id: "pinot-noir",
    name: "Pinot Noir",
    color: "red",
    exploreGrape: "Pinot Noir",
    tagline: "Thin-skinned, fussy and silky.",
    about: "Pinot Noir's thin skins make paler, lighter-bodied reds with bright acidity and soft tannin. It needs a cool climate and careful farming, but at its best it's fragrant and layered, with fruit and earthy, savory notes together.",
    notes: ["red cherry", "raspberry", "mushroom", "earth"],
    profile: { sweetness: 1, acidity: 4, tannin: 2, body: 2, fruitiness: 3 },
    regions: ["Burgundy", "Willamette Valley", "Sonoma Coast", "Central Otago"],
    source: "general",
  },
  {
    id: "syrah",
    name: "Syrah / Shiraz",
    color: "red",
    exploreGrape: "Syrah",
    tagline: "Dark, peppery and bold. Called Shiraz in Australia.",
    about: "Syrah makes deeply colored, full-bodied wines. In France's Northern Rhône it's savory and peppery; in warm Australia, where it goes by Shiraz, it's riper, richer and jammier.",
    notes: ["blackberry", "black pepper", "smoked meat"],
    profile: { sweetness: 1, acidity: 3, tannin: 4, body: 5, fruitiness: 4 },
    regions: ["Northern Rhône", "Barossa Valley", "Washington"],
    source: "general",
  },
  {
    id: "chardonnay",
    name: "Chardonnay",
    color: "white",
    exploreGrape: "Chardonnay",
    tagline: "The shape-shifter of white wine.",
    about: "Chardonnay is fairly neutral on its own, so climate and winemaking shape it. Cool-climate, unoaked styles like Chablis are lean and citrusy; warm-climate, oak-aged styles are rich and creamy, with notes of butter and vanilla.",
    notes: ["apple", "lemon", "pineapple", "butter", "vanilla"],
    profile: { sweetness: 1, acidity: 3, tannin: 1, body: [2, 4], fruitiness: 3 },
    regions: ["Burgundy (Chablis, Meursault)", "California", "Australia"],
    source: "general",
  },
  {
    id: "sauvignon-blanc",
    name: "Sauvignon Blanc",
    color: "white",
    exploreGrape: "Sauvignon Blanc",
    tagline: "Zesty, aromatic and green.",
    about: "Sauvignon Blanc is all about bright acidity and pungent aromas, from citrus and passion fruit to fresh-cut grass. It's usually made in stainless steel and drunk young, to keep that freshness.",
    notes: ["grapefruit", "green apple", "cut grass", "passion fruit"],
    profile: { sweetness: 1, acidity: 5, tannin: 1, body: 2, fruitiness: 4 },
    regions: ["Loire (Sancerre)", "Marlborough", "Bordeaux"],
    source: "general",
  },
  {
    id: "riesling",
    name: "Riesling",
    color: "white",
    exploreGrape: "Riesling",
    tagline: "Electric acidity, from bone dry to lusciously sweet.",
    about: "Riesling's high acidity keeps it refreshing at every sweetness level, from bone-dry Alsace and Australian styles to sweet German late-harvest wines. It's rarely oaked, and the best bottles age for decades, picking up honeyed, petrol-like notes.",
    notes: ["lime", "green apple", "peach", "honey", "petrol (with age)"],
    profile: { sweetness: [1, 5], acidity: 5, tannin: 1, body: 2, fruitiness: 4 },
    regions: ["Mosel", "Alsace", "Clare Valley", "Finger Lakes"],
    source: "general",
  },
];
```

- [ ] **Step 7: Run them to verify they pass**

Run: `npx vitest run src/content/learn`
Expected: all PASS (taste, vine, grapes content and both dataset tests).

- [ ] **Step 8: Commit**

```bash
git add src/test/dataset.ts src/content/learn/taste.dataset.test.ts src/content/learn/grapes.ts src/content/learn/grapes.test.ts src/content/learn/grapes.dataset.test.ts
git commit -m "feat(learn): add Key Grapes content and share the dataset test helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `ProfileBars`

**Files:**
- Create: `src/components/learn/grapes/ProfileBars.tsx`, `src/components/learn/grapes/ProfileBars.test.tsx`

**Interfaces:**
- Consumes: `DIMENSIONS`, `DIMENSION_TITLES`, `DIMENSION_LABELS`, `type Dimension`; `type ProfileValue` from `src/content/learn/grapes.ts`.
- Produces: `export function ProfileBars({ profile }: { profile: Record<Dimension, ProfileValue> })` — `<ul aria-label="Taste profile">` with one `<li>` per dimension; each segment has `data-testid="segment"` and `data-state="filled" | "range" | "empty"`.

- [ ] **Step 1: Write the failing test** — `src/components/learn/grapes/ProfileBars.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProfileBars } from "./ProfileBars";

const PROFILE = { sweetness: [1, 5] as const, acidity: 5, tannin: 1, body: 4, fruitiness: 3 };

function states(row: HTMLElement) {
  return within(row)
    .getAllByTestId("segment")
    .map((segment) => segment.dataset.state);
}

describe("ProfileBars", () => {
  it("renders the five scales in order with readable text", () => {
    render(<ProfileBars profile={PROFILE} />);
    const rows = within(screen.getByRole("list", { name: "Taste profile" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Sweetness: ranges from Very dry to Very sweet"),
      expect.stringContaining("Acidity: High acidity, 5 of 5"),
      expect.stringContaining("Tannin: Low tannin, 1 of 5"),
      expect.stringContaining("Body: Full-bodied, 4 of 5"),
      expect.stringContaining("Fruit Intensity: Moderate fruit, 3 of 5"),
    ]);
  });

  it("fills a single score up to its value", () => {
    render(<ProfileBars profile={PROFILE} />);
    const body = screen.getAllByRole("listitem")[3];
    expect(states(body)).toEqual(["filled", "filled", "filled", "filled", "empty"]);
  });

  it("marks a range across its span", () => {
    render(<ProfileBars profile={{ ...PROFILE, sweetness: [2, 4] }} />);
    const sweetness = screen.getAllByRole("listitem")[0];
    expect(states(sweetness)).toEqual(["empty", "range", "range", "range", "empty"]);
  });

  it("hides the segments from assistive technology", () => {
    render(<ProfileBars profile={PROFILE} />);
    for (const segment of screen.getAllByTestId("segment")) {
      expect(segment.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/grapes/ProfileBars.test.tsx`
Expected: FAIL — cannot resolve `./ProfileBars`.

- [ ] **Step 3: Implement** — `src/components/learn/grapes/ProfileBars.tsx`

```tsx
import type { ProfileValue } from "../../../content/learn/grapes";
import { DIMENSIONS, DIMENSION_LABELS, DIMENSION_TITLES, type Dimension } from "../../../utils/dimensionLabels";

const STEPS = [1, 2, 3, 4, 5] as const;

function describeValue(dimension: Dimension, value: ProfileValue): string {
  const title = DIMENSION_TITLES[dimension];
  const labels = DIMENSION_LABELS[dimension];
  if (typeof value === "number") return `${title}: ${labels[value]}, ${value} of 5`;
  return `${title}: ranges from ${labels[value[0]]} to ${labels[value[1]]}`;
}

function segmentState(value: ProfileValue, step: number): "filled" | "range" | "empty" {
  if (typeof value === "number") return step <= value ? "filled" : "empty";
  return step >= value[0] && step <= value[1] ? "range" : "empty";
}

// Ranges use a lighter fill; the accent token has no Tailwind opacity modifier, so opacity goes on the element.
const SEGMENT_CLASS = { filled: "bg-accent", range: "bg-accent opacity-50", empty: "bg-surface-border" } as const;

export function ProfileBars({ profile }: { profile: Record<Dimension, ProfileValue> }) {
  return (
    <ul aria-label="Taste profile" className="grid gap-2">
      {DIMENSIONS.map((dimension) => {
        const value = profile[dimension];
        return (
          <li key={dimension} className="grid grid-cols-[7rem_1fr] items-center gap-3">
            <span className="sr-only">{describeValue(dimension, value)}</span>
            <span aria-hidden="true" className="text-xs text-ink-muted">
              {DIMENSION_TITLES[dimension]}
            </span>
            <span aria-hidden="true" className="grid grid-cols-5 gap-1">
              {STEPS.map((step) => {
                const state = segmentState(value, step);
                return (
                  <span key={step} data-testid="segment" data-state={state} className={`h-2 rounded-full ${SEGMENT_CLASS[state]}`} />
                );
              })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/learn/grapes/ProfileBars.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/grapes/ProfileBars.tsx src/components/learn/grapes/ProfileBars.test.tsx
git commit -m "feat(learn): add grape taste-profile bars with range support

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `GrapeExploreLink`

**Files:**
- Create: `src/components/learn/grapes/GrapeExploreLink.tsx`, `src/components/learn/grapes/GrapeExploreLink.test.tsx`

**Interfaces:**
- Consumes: `listWines` from `src/services/api.ts`.
- Produces: `export function GrapeExploreLink({ name, exploreGrape }: { name: string; exploreGrape: string })` — a router `<Link>` to `/explore?grape=<encodeURIComponent(exploreGrape)>`; accessible name "Explore {N} {name} wines" (or "wine" when N is 1), or "Explore {name} wines" before/without a count.

- [ ] **Step 1: Write the failing test** — `src/components/learn/grapes/GrapeExploreLink.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import type { WineListResponse } from "../../../types/wine";
import { GrapeExploreLink } from "./GrapeExploreLink";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
});

function renderLink(name: string, exploreGrape: string) {
  return render(
    <MemoryRouter>
      <GrapeExploreLink name={name} exploreGrape={exploreGrape} />
    </MemoryRouter>
  );
}

describe("GrapeExploreLink", () => {
  it("links to Explore filtered by the grape, with an encoded value", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderLink("Sauvignon Blanc", "Sauvignon Blanc");
    expect(screen.getByRole("link", { name: "Explore Sauvignon Blanc wines" })).toHaveAttribute(
      "href",
      "/explore?grape=Sauvignon%20Blanc"
    );
  });

  it("shows the catalog count once it loads, using the same filter", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 13, items: [] });
    renderLink("Pinot Noir", "Pinot Noir");
    expect(await screen.findByRole("link", { name: "Explore 13 Pinot Noir wines" })).toBeInTheDocument();
    expect(api.listWines).toHaveBeenCalledWith({ grape: "Pinot Noir", limit: 1 });
  });

  it("uses the singular for a single wine", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 1, items: [] });
    renderLink("Merlot", "Merlot");
    expect(await screen.findByRole("link", { name: "Explore 1 Merlot wine" })).toBeInTheDocument();
  });

  it("falls back to the plain label when the count fails", async () => {
    vi.mocked(api.listWines).mockRejectedValue(new Error("network"));
    renderLink("Riesling", "Riesling");
    await act(async () => {});
    expect(screen.getByRole("link", { name: "Explore Riesling wines" })).toBeInTheDocument();
  });

  it("ignores a late count for a previous grape", async () => {
    let resolveFirst!: (value: WineListResponse) => void;
    vi.mocked(api.listWines)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ total: 9, items: [] });
    const { rerender } = renderLink("Merlot", "Merlot");
    rerender(
      <MemoryRouter>
        <GrapeExploreLink name="Chardonnay" exploreGrape="Chardonnay" />
      </MemoryRouter>
    );
    expect(await screen.findByRole("link", { name: "Explore 9 Chardonnay wines" })).toBeInTheDocument();
    await act(async () => resolveFirst({ total: 11, items: [] }));
    expect(screen.getByRole("link", { name: "Explore 9 Chardonnay wines" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/grapes/GrapeExploreLink.test.tsx`
Expected: FAIL — cannot resolve `./GrapeExploreLink`.

- [ ] **Step 3: Implement** — `src/components/learn/grapes/GrapeExploreLink.tsx`

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listWines } from "../../../services/api";

export function GrapeExploreLink({ name, exploreGrape }: { name: string; exploreGrape: string }) {
  const [count, setCount] = useState<number | null>(null);

  // Same filter the link applies, so the count always matches what Explore shows.
  useEffect(() => {
    let active = true;
    setCount(null);
    listWines({ grape: exploreGrape, limit: 1 })
      .then((response) => {
        if (active) setCount(response.total);
      })
      .catch(() => {
        // No count is fine; the link still works.
      });
    return () => {
      active = false;
    };
  }, [exploreGrape]);

  const label = count === null ? `Explore ${name} wines` : `Explore ${count} ${name} ${count === 1 ? "wine" : "wines"}`;

  return (
    <Link
      to={`/explore?grape=${encodeURIComponent(exploreGrape)}`}
      className="inline-block border border-accent text-accent font-semibold px-5 py-2.5 rounded hover:bg-accent hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {label} <span aria-hidden="true">→</span>
    </Link>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/learn/grapes/GrapeExploreLink.test.tsx`
Expected: all PASS, no `act(...)` warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/grapes/GrapeExploreLink.tsx src/components/learn/grapes/GrapeExploreLink.test.tsx
git commit -m "feat(learn): add grape Explore link with a live catalog count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `GrapePicker` (tabs widget)

**Files:**
- Create: `src/components/learn/grapes/GrapePicker.tsx`, `src/components/learn/grapes/GrapePicker.test.tsx`

**Interfaces:**
- Consumes: `type GrapeContent` (Task 1).
- Produces:
  - `export function grapeTabId(id: string): string` → `` `grape-${id}` ``
  - `export const GRAPE_PANEL_ID = "grape-panel";`
  - `export function GrapePicker({ grapes, selectedId, onSelect }: { grapes: readonly GrapeContent[]; selectedId: string; onSelect: (id: string) => void })`

- [ ] **Step 1: Write the failing test** — `src/components/learn/grapes/GrapePicker.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { GRAPES } from "../../../content/learn/grapes";
import { GRAPE_PANEL_ID, GrapePicker } from "./GrapePicker";

function Harness({ initial = "cabernet-sauvignon", onSelect = vi.fn() }: { initial?: string; onSelect?: (id: string) => void }) {
  const [selected, setSelected] = useState(initial);
  return (
    <GrapePicker
      grapes={GRAPES}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id);
        onSelect(id);
      }}
    />
  );
}

const selectedName = () => screen.getByRole("tab", { selected: true }).textContent;

describe("GrapePicker", () => {
  it("renders one tablist with the seven grapes in order", () => {
    render(<Harness />);
    const tablist = screen.getByRole("tablist", { name: "Grapes" });
    expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Cabernet Sauvignon",
      "Merlot",
      "Pinot Noir",
      "Syrah / Shiraz",
      "Chardonnay",
      "Sauvignon Blanc",
      "Riesling",
    ]);
  });

  it("wires each tab to its id and the shared panel", () => {
    render(<Harness />);
    const tab = screen.getByRole("tab", { name: "Pinot Noir" });
    expect(tab).toHaveAttribute("id", "grape-pinot-noir");
    expect(tab).toHaveAttribute("aria-controls", GRAPE_PANEL_ID);
  });

  it("marks only the selected tab as selected and tabbable", () => {
    render(<Harness initial="merlot" />);
    for (const tab of screen.getAllByRole("tab")) {
      const isMerlot = tab.textContent === "Merlot";
      expect(tab).toHaveAttribute("aria-selected", String(isMerlot));
      expect(tab).toHaveAttribute("tabindex", isMerlot ? "0" : "-1");
    }
  });

  it("selects on click", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("tab", { name: "Riesling" }));
    expect(onSelect).toHaveBeenLastCalledWith("riesling");
    expect(selectedName()).toBe("Riesling");
  });

  it("moves with arrow keys, wrapping at the ends, and follows focus", async () => {
    render(<Harness />);
    screen.getByRole("tab", { name: "Cabernet Sauvignon" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(selectedName()).toBe("Merlot");
    expect(screen.getByRole("tab", { name: "Merlot" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(selectedName()).toBe("Riesling");
    await userEvent.keyboard("{ArrowDown}");
    expect(selectedName()).toBe("Cabernet Sauvignon");
    await userEvent.keyboard("{ArrowUp}");
    expect(selectedName()).toBe("Riesling");
  });

  it("jumps with Home and End", async () => {
    render(<Harness initial="pinot-noir" />);
    screen.getByRole("tab", { name: "Pinot Noir" }).focus();
    await userEvent.keyboard("{End}");
    expect(selectedName()).toBe("Riesling");
    await userEvent.keyboard("{Home}");
    expect(selectedName()).toBe("Cabernet Sauvignon");
  });

  it("keeps the group labels out of the accessibility tree", () => {
    render(<Harness />);
    for (const label of [screen.getByText("Reds"), screen.getByText("Whites")]) {
      expect(label).toHaveAttribute("aria-hidden", "true");
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/grapes/GrapePicker.test.tsx`
Expected: FAIL — cannot resolve `./GrapePicker`.

- [ ] **Step 3: Implement** — `src/components/learn/grapes/GrapePicker.tsx`

```tsx
import { Fragment, useRef, type KeyboardEvent } from "react";
import type { GrapeContent } from "../../../content/learn/grapes";

export const GRAPE_PANEL_ID = "grape-panel";

export function grapeTabId(id: string): string {
  return `grape-${id}`;
}

const DOT_CLASS = { red: "bg-wine-red", white: "bg-wine-white" } as const;
const GROUP_LABEL = { red: "Reds", white: "Whites" } as const;

interface GrapePickerProps {
  grapes: readonly GrapeContent[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function GrapePicker({ grapes, selectedId, onSelect }: GrapePickerProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // WAI-ARIA tabs with automatic activation: moving focus selects.
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = grapes.length - 1;
    const next: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    const target = next[event.key];
    onSelect(grapes[target].id);
    tabRefs.current[target]?.focus();
  }

  return (
    <div role="tablist" aria-label="Grapes" className="flex items-center gap-2 overflow-x-auto pb-2">
      {grapes.map((grape, index) => {
        const selected = grape.id === selectedId;
        const startsGroup = index === 0 || grapes[index - 1].color !== grape.color;
        return (
          <Fragment key={grape.id}>
            {startsGroup ? (
              <span
                aria-hidden="true"
                className={`shrink-0 text-xs uppercase tracking-[0.2em] text-ink-muted ${index === 0 ? "" : "ml-4"}`}
              >
                {GROUP_LABEL[grape.color]}
              </span>
            ) : null}
            <button
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={grapeTabId(grape.id)}
              aria-selected={selected}
              aria-controls={GRAPE_PANEL_ID}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(grape.id)}
              onKeyDown={(event) => move(event, index)}
              className={`scroll-mt-24 shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                selected ? "border-accent text-accent" : "border-surface-border text-ink-muted hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full border border-surface-border ${DOT_CLASS[grape.color]}`} />
              {grape.name}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/learn/grapes/GrapePicker.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/grapes/GrapePicker.tsx src/components/learn/grapes/GrapePicker.test.tsx
git commit -m "feat(learn): add accessible grape picker tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `GrapeArt` + `GrapePanel`

**Files:**
- Create: `src/components/learn/grapes/GrapeArt.tsx`
- Create: `src/components/learn/grapes/GrapePanel.tsx`, `src/components/learn/grapes/GrapePanel.test.tsx`

**Interfaces:**
- Consumes: `type GrapeContent`, `type GrapeColor` (Task 1); `ProfileBars` (Task 2); `GrapeExploreLink` (Task 3); `GRAPE_PANEL_ID`, `grapeTabId` (Task 4); `useReveal` from `src/hooks/useReveal.ts`; `cssVars` from `src/components/home/art/cssVars.ts`; `home.css`, `learn.css`.
- Produces:
  - `export function GrapeArt({ color }: { color: GrapeColor })`
  - `export function GrapePanel({ grape }: { grape: GrapeContent })` — `<div role="tabpanel" id={GRAPE_PANEL_ID} aria-labelledby={grapeTabId(grape.id)}>`; the caller renders it with `key={grape.id}`.

- [ ] **Step 1: Write the failing test** — `src/components/learn/grapes/GrapePanel.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import { GRAPES } from "../../../content/learn/grapes";
import { GrapePanel } from "./GrapePanel";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

const RIESLING = GRAPES.find((grape) => grape.id === "riesling")!;
const MERLOT = GRAPES.find((grape) => grape.id === "merlot")!;

beforeEach(() => {
  vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
});

function renderPanel(grape = RIESLING) {
  return render(
    <MemoryRouter>
      <button role="tab" id={`grape-${grape.id}`}>
        {grape.name}
      </button>
      <GrapePanel grape={grape} />
    </MemoryRouter>
  );
}

describe("GrapePanel", () => {
  it("is a tabpanel labelled by its tab", () => {
    renderPanel();
    const panel = screen.getByRole("tabpanel", { name: "Riesling" });
    expect(panel).toHaveAttribute("id", "grape-panel");
  });

  it("shows the grape's copy, notes, regions, profile and Explore link", () => {
    renderPanel();
    expect(screen.getByRole("heading", { level: 3, name: "Riesling" })).toBeInTheDocument();
    expect(screen.getByText("White grape")).toBeInTheDocument();
    expect(screen.getByText(RIESLING.tagline)).toBeInTheDocument();
    expect(screen.getByText(RIESLING.about)).toBeInTheDocument();
    for (const note of RIESLING.notes) expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByText(RIESLING.regions.join(", "))).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Taste profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Riesling wines" })).toHaveAttribute("href", "/explore?grape=Riesling");
  });

  it("names red grapes as red", () => {
    renderPanel(MERLOT);
    expect(screen.getByText("Red grape")).toBeInTheDocument();
  });

  it("hides the art from assistive technology", () => {
    renderPanel();
    expect(screen.getByTestId("grape-art")).toHaveAttribute("aria-hidden", "true");
    for (const stroke of screen.getByTestId("grape-art").querySelectorAll(".draw")) {
      expect(stroke).toHaveAttribute("pathLength", "1");
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/grapes/GrapePanel.test.tsx`
Expected: FAIL — cannot resolve `./GrapePanel`.

- [ ] **Step 3: Implement** — `src/components/learn/grapes/GrapeArt.tsx`

A stem and vine leaf draw in, then the berries pop in filled with the grape's wine color.

```tsx
import type { GrapeColor } from "../../../content/learn/grapes";
import { cssVars } from "../../home/art/cssVars";

const BERRIES: ReadonlyArray<readonly [x: number, y: number]> = [
  [68, 64],
  [86, 60],
  [104, 60],
  [122, 60],
  [140, 64],
  [78, 80],
  [96, 78],
  [114, 78],
  [132, 80],
  [88, 96],
  [106, 96],
  [124, 96],
  [98, 112],
  [116, 112],
  [107, 128],
];

const BERRY_FILL: Record<GrapeColor, string> = { red: "fill-wine-red", white: "fill-wine-white" };

export function GrapeArt({ color }: { color: GrapeColor }) {
  return (
    <svg viewBox="0 0 210 160" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M104 50 V30 q10 -12 26 -10" fill="none" strokeWidth="1.6" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.25s" })}
        d="M130 20 q24 -20 50 -4 q-6 26 -34 24 q-14 -6 -16 -20 z"
        fill="none"
        strokeWidth="1.3"
      />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.45s" })}
        d="M132 20 q20 2 40 -2"
        fill="none"
        strokeWidth="0.8"
      />
      {BERRIES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className={`pop ${BERRY_FILL[color]} stroke-accent`}
          style={cssVars({ "--delay": `${0.6 + i * 0.05}s` })}
          cx={x}
          cy={y}
          r="9"
          fillOpacity="0.85"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 4: Implement** — `src/components/learn/grapes/GrapePanel.tsx`

```tsx
import { useRef } from "react";
import type { GrapeContent } from "../../../content/learn/grapes";
import { useReveal } from "../../../hooks/useReveal";
import { GrapeArt } from "./GrapeArt";
import { GrapeExploreLink } from "./GrapeExploreLink";
import { GRAPE_PANEL_ID, grapeTabId } from "./GrapePicker";
import { ProfileBars } from "./ProfileBars";
import "../../home/home.css";
import "../learn.css";

const COLOR_LABEL = { red: "Red grape", white: "White grape" } as const;

export function GrapePanel({ grape }: { grape: GrapeContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useReveal(ref);
  const classes = ["scene grid gap-8 rounded border border-surface-border p-6 mt-4 md:grid-cols-3 md:items-start", ...reveal];

  return (
    <div ref={ref} role="tabpanel" id={GRAPE_PANEL_ID} aria-labelledby={grapeTabId(grape.id)} className={classes.join(" ")}>
      <div data-testid="grape-art" aria-hidden="true">
        <GrapeArt color={grape.color} />
      </div>
      <div className="md:col-span-2 grid gap-4">
        <div>
          <h3 className="font-serif text-2xl text-ink">{grape.name}</h3>
          <p className="text-xs uppercase tracking-wide text-accent mt-1">{COLOR_LABEL[grape.color]}</p>
          <p className="text-ink-muted mt-2">{grape.tagline}</p>
        </div>
        <dl className="grid gap-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">What it's like</dt>
            <dd className="text-ink">{grape.about}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Tastes like</dt>
            <dd>
              <ul className="mt-1 flex flex-wrap gap-2">
                {grape.notes.map((note) => (
                  <li key={note} className="rounded-full border border-surface-border px-3 py-1 text-sm text-ink">
                    {note}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent mb-2">Typical profile</dt>
            <dd>
              <ProfileBars profile={grape.profile} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Where it shines</dt>
            <dd className="text-ink">{grape.regions.join(", ")}</dd>
          </div>
        </dl>
        <div>
          <GrapeExploreLink name={grape.name} exploreGrape={grape.exploreGrape} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/components/learn/grapes/GrapePanel.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/learn/grapes/GrapeArt.tsx src/components/learn/grapes/GrapePanel.tsx src/components/learn/grapes/GrapePanel.test.tsx
git commit -m "feat(learn): add the grape detail panel and cluster art

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `GrapesChapter` (selection + deep links)

**Files:**
- Create: `src/components/learn/grapes/GrapesChapter.tsx`, `src/components/learn/grapes/GrapesChapter.test.tsx`

**Interfaces:**
- Consumes: `GRAPES`, `DEFAULT_GRAPE_ID` (Task 1); `GrapePicker`, `grapeTabId` (Task 4); `GrapePanel` (Task 5); `useLocation`, `useNavigate` from `react-router-dom`.
- Produces: `export function GrapesChapter()` — chapter body (wrapped by `ChapterSection` in Task 7); `export function grapeIdFromHash(hash: string): string`.

- [ ] **Step 1: Write the failing test** — `src/components/learn/grapes/GrapesChapter.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import * as api from "../../../services/api";
import { GrapesChapter, grapeIdFromHash } from "./GrapesChapter";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
});

function LocationProbe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.hash} {type}
    </p>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GrapesChapter />
      <LocationProbe />
    </MemoryRouter>
  );
}

const selectedName = () => screen.getByRole("tab", { selected: true }).textContent;

describe("grapeIdFromHash", () => {
  it("reads a known grape slug", () => {
    expect(grapeIdFromHash("#grape-riesling")).toBe("riesling");
  });

  it("falls back to the default for anything else", () => {
    expect(grapeIdFromHash("")).toBe("cabernet-sauvignon");
    expect(grapeIdFromHash("#vine")).toBe("cabernet-sauvignon");
    expect(grapeIdFromHash("#grape-zinfandel")).toBe("cabernet-sauvignon");
  });
});

describe("GrapesChapter", () => {
  it("starts on Cabernet Sauvignon", () => {
    renderAt("/learn");
    expect(selectedName()).toBe("Cabernet Sauvignon");
    expect(screen.getByRole("tabpanel", { name: "Cabernet Sauvignon" })).toBeInTheDocument();
  });

  it("opens the grape named in the hash", () => {
    renderAt("/learn#grape-riesling");
    expect(selectedName()).toBe("Riesling");
    expect(screen.getByRole("heading", { level: 3, name: "Riesling" })).toBeInTheDocument();
  });

  it("falls back to the default for an unknown grape", () => {
    renderAt("/learn#grape-zinfandel");
    expect(selectedName()).toBe("Cabernet Sauvignon");
  });

  it("writes the selection to the hash without a new history entry", async () => {
    renderAt("/learn");
    await userEvent.click(screen.getByRole("tab", { name: "Pinot Noir" }));
    expect(screen.getByRole("tabpanel", { name: "Pinot Noir" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/learn#grape-pinot-noir REPLACE");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/learn/grapes/GrapesChapter.test.tsx`
Expected: FAIL — cannot resolve `./GrapesChapter`.

- [ ] **Step 3: Implement** — `src/components/learn/grapes/GrapesChapter.tsx`

```tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_GRAPE_ID, GRAPES } from "../../../content/learn/grapes";
import { GrapePanel } from "./GrapePanel";
import { GrapePicker, grapeTabId } from "./GrapePicker";

const HASH_PREFIX = "#grape-";

export function grapeIdFromHash(hash: string): string {
  if (!hash.startsWith(HASH_PREFIX)) return DEFAULT_GRAPE_ID;
  const id = hash.slice(HASH_PREFIX.length);
  return GRAPES.some((grape) => grape.id === id) ? id : DEFAULT_GRAPE_ID;
}

export function GrapesChapter() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  // Read once on arrival; afterwards the selection drives the hash, not the other way round.
  const [selectedId, setSelectedId] = useState(() => grapeIdFromHash(hash));
  const grape = GRAPES.find((candidate) => candidate.id === selectedId) ?? GRAPES[0];

  function select(id: string) {
    setSelectedId(id);
    // Replace, so browsing grapes doesn't fill the back button; no scroll happens on a hash-only replace.
    navigate({ hash: `#${grapeTabId(id)}` }, { replace: true });
  }

  return (
    <div className="mt-8">
      <GrapePicker grapes={GRAPES} selectedId={selectedId} onSelect={select} />
      {/* Keyed so the panel remounts and its art redraws for each grape. */}
      <GrapePanel key={grape.id} grape={grape} />
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/learn/grapes`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/grapes/GrapesChapter.tsx src/components/learn/grapes/GrapesChapter.test.tsx
git commit -m "feat(learn): add the Key Grapes chapter with hash deep links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wire the chapter in, home copy, full verification

**Files:**
- Modify: `src/components/learn/chapters.ts`
- Modify: `src/pages/LearnPage.test.tsx`
- Modify: `src/components/home/scenes/LearnScene.tsx`, `src/components/home/scenes/FeatureScenes.test.tsx`

**Interfaces:**
- Consumes: `GRAPES_CHAPTER` (Task 1); `GrapesChapter` (Task 6).
- Produces: `LEARN_CHAPTERS` = `[taste, vine, grapes]`.

- [ ] **Step 1: Add page tests** — in `src/pages/LearnPage.test.tsx`, inside `describe("LearnPage", …)`, add:

```tsx
  it("lists all three chapters in the nav", () => {
    renderAt("/learn");
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "How to Taste",
      "Vine to Glass",
      "Key Grapes",
    ]);
  });

  it("renders the Key Grapes chapter third", () => {
    renderAt("/learn");
    expect(screen.getByRole("region", { name: "Seven grapes to know" })).toHaveAttribute("id", "grapes");
    expect(screen.getByText("03 · Key Grapes")).toBeInTheDocument();
  });

  it("opens and scrolls to a grape from the hash on arrival", () => {
    renderAt("/learn#grape-pinot-noir");
    const tab = screen.getByRole("tab", { name: "Pinot Noir" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(scrollIntoView.mock.instances[0]).toBe(tab);
  });
```

- [ ] **Step 2: Update the home scene test** — in `src/components/home/scenes/FeatureScenes.test.tsx`, replace the `LearnScene` describe block with:

```tsx
describe("LearnScene", () => {
  it("describes the Learn chapters", () => {
    renderScene(LearnScene);
    expect(screen.getByText(/five things your mouth is measuring/i)).toBeInTheDocument();
    expect(screen.getByText(/from the vineyard to your glass/i)).toBeInTheDocument();
    expect(screen.getByText(/seven grapes worth knowing/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx`
Expected: FAIL — no third chapter, no grape tab, copy not found.

- [ ] **Step 4: Add the chapter** — in `src/components/learn/chapters.ts`, add the imports:

```ts
import { GRAPES_CHAPTER } from "../../content/learn/grapes";
import { GrapesChapter } from "./grapes/GrapesChapter";
```

and append to `LEARN_CHAPTERS` after the `vine` entry:

```ts
  {
    id: GRAPES_CHAPTER.id,
    label: GRAPES_CHAPTER.label,
    title: GRAPES_CHAPTER.title,
    lead: GRAPES_CHAPTER.lead,
    Component: GrapesChapter,
  },
```

- [ ] **Step 5: Update the home copy** — in `src/components/home/scenes/LearnScene.tsx`, replace the paragraph text:

```tsx
      <p className="text-ink-muted mb-6">
        Learn the five things your mouth is measuring, with real wines to taste the difference — then follow a grape
        from the vineyard to your glass, and meet the seven grapes worth knowing.
      </p>
```

- [ ] **Step 6: Run them to verify they pass**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx src/App.test.tsx`
Expected: all PASS.

- [ ] **Step 7: Full suite and build**

Run: `npx vitest run`
Expected: all files pass, no new `act(...)` warnings.

Run: `npm run build`
Expected: `tsc -b` clean and Vite build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/learn/chapters.ts src/pages/LearnPage.test.tsx src/components/home/scenes/LearnScene.tsx src/components/home/scenes/FeatureScenes.test.tsx
git commit -m "feat(learn): add Key Grapes as the third Learn chapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Visual check (controller / user)**

With backend + `npm run dev` running, open `/learn` at desktop and phone widths, both themes, reduced motion on and off. Confirm: the nav shows three chapters; the grape chips scroll sideways on phones; arrow keys move between grapes; the panel's cluster redraws per grape in the right wine color; Riesling's sweetness and Chardonnay's body show as lighter ranges; Explore buttons show counts and open filtered Explore; `/learn#grape-pinot-noir` opens Pinot Noir.
