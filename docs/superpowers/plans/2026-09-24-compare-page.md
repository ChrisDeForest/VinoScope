# VinoScope Compare Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Compare page — pick 2–4 wines via an in-page search picker, see them side by side in a field-by-field table and a radar chart of their five characteristics — replacing the current `/compare` stub.

**Architecture:** Selection state lives in the URL (`?wines=1,2,3`) via a `useCompareSelection` hook wrapping `useSearchParams`. `ComparePage` fetches each selected wine's full detail via the existing `GET /api/wines/{id}` and tracks per-wine load state in a map keyed by ID (not one page-level flag), so one wine's failure doesn't break the others. Four new presentational components (`WineSearchPicker`, `CompareSlot`, `CompareTable`, `CompareRadarChart`) are each self-contained and independently testable. No backend changes.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, react-router-dom (existing) — plus one new dependency, `recharts`, for the radar chart.

## Global Constraints

- No backend changes — `GET /api/wines/{id}` (`services/api.ts`'s existing `getWine`) already returns everything Compare needs.
- One new runtime dependency: `recharts@^3.10.1`.
- No debounced/live search — the picker searches on explicit submit (Enter or a Search button), matching the only existing search-input convention in this codebase (`FilterDrawer`'s draft-then-apply pattern); no debounce utility exists anywhere in this codebase.
- Selection is capped at 4 wines, deduplicated, non-numeric URL values dropped; the table/radar chart only render once 2+ wines have successfully loaded.
- No ratings or food-pairing rows in the table — neither field exists in the backend data model.
- `formatGrapeBreakdown`'s `name (percentage%)` convention matches `WineDetailPage`'s existing inline grape formatting exactly; its empty-list case returns `"Not specified"`, matching `WineDetailPage`'s existing empty-grapes copy.
- Radar chart series use a fixed 4-color categorical palette plus a distinct stroke-dasharray per wine (not just color) — validated with the dataviz skill's `validate_palette.js` against all three VinoScope theme surfaces; only the first 3 slots clear the all-pairs CVD floor, so the 4th wine's dash pattern is the accessibility mitigation for that pair, per the skill's own "6–8 CVD is legal only with secondary encoding" rule.
- Tests use Vitest + React Testing Library; the API layer (`frontend/src/services/api.ts`) is mocked at the test boundary, matching every other frontend page test in this codebase.
- Mobile-responsive down to phone width — `CompareTable` scrolls horizontally in its own `overflow-x-auto` container rather than overflowing the page.

---

### Task 1: `formatGrapeBreakdown` utility

**Files:**
- Modify: `frontend/src/utils/format.ts`
- Modify: `frontend/src/utils/format.test.ts`

**Interfaces:**
- Consumes: `Grape` type (existing, `frontend/src/types/wine.ts`).
- Produces: `formatGrapeBreakdown(grapes: Grape[]): string` from `frontend/src/utils/format.ts` — used by Task 5's `CompareTable`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/utils/format.test.ts` (and add `formatGrapeBreakdown` to the existing import line at the top of the file):
```typescript
import {
  formatPrice,
  formatApproxUsd,
  hasApproxUsdConversion,
  formatVintage,
  primaryGrapeLabel,
  formatGrapeBreakdown,
} from "./format";

// ...(existing describe blocks unchanged)...

describe("formatGrapeBreakdown", () => {
  it("returns 'Not specified' for an empty list", () => {
    expect(formatGrapeBreakdown([])).toBe("Not specified");
  });

  it("returns the bare name when percentage is null", () => {
    expect(formatGrapeBreakdown([{ name: "Chardonnay", percentage: null }])).toBe("Chardonnay");
  });

  it("includes the percentage in parentheses when present", () => {
    expect(formatGrapeBreakdown([{ name: "Chardonnay", percentage: 100 }])).toBe("Chardonnay (100%)");
  });

  it("joins a multi-grape blend with commas", () => {
    expect(
      formatGrapeBreakdown([
        { name: "Cabernet Sauvignon", percentage: 80 },
        { name: "Merlot", percentage: 20 },
      ])
    ).toBe("Cabernet Sauvignon (80%), Merlot (20%)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test`
Expected: FAIL — `formatGrapeBreakdown` is not exported from `./format` (TypeScript/import error).

- [ ] **Step 3: Write the implementation**

In `frontend/src/utils/format.ts`, add the import and the function:
```typescript
import type { Grape } from "../types/wine";
```
(add this as the first line of the file)

```typescript
export function formatGrapeBreakdown(grapes: Grape[]): string {
  if (grapes.length === 0) return "Not specified";
  return grapes.map((g) => (g.percentage === null ? g.name : `${g.name} (${g.percentage}%)`)).join(", ");
}
```
(add this at the end of the file, after `primaryGrapeLabel`)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test`
Expected: PASS (4 new tests, all existing `format.test.ts` tests still green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/format.ts frontend/src/utils/format.test.ts
git commit -m "feat: add formatGrapeBreakdown for the Compare table"
```

---

### Task 2: `useCompareSelection` hook

**Files:**
- Create: `frontend/src/hooks/useCompareSelection.ts`
- Test: `frontend/src/hooks/useCompareSelection.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` (existing, `react-router-dom`).
- Produces: `useCompareSelection(): { selectedIds: number[]; addWine: (id: number) => void; removeWine: (id: number) => void }` from `frontend/src/hooks/useCompareSelection.ts` — used by Task 7's `ComparePage`.

- [ ] **Step 1: Write the failing test**

`frontend/src/hooks/useCompareSelection.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useCompareSelection } from "./useCompareSelection";

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe("useCompareSelection", () => {
  it("starts empty when there is no wines param", () => {
    const { result } = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare"]) });
    expect(result.current.selectedIds).toEqual([]);
  });

  it("parses a comma-separated wines param", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=12,45,78"]),
    });
    expect(result.current.selectedIds).toEqual([12, 45, 78]);
  });

  it("dedupes repeated ids and drops non-numeric entries", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=12,12,abc,45"]),
    });
    expect(result.current.selectedIds).toEqual([12, 45]);
  });

  it("caps at 4 ids, dropping the rest", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=1,2,3,4,5,6"]),
    });
    expect(result.current.selectedIds).toEqual([1, 2, 3, 4]);
  });

  it("addWine appends an id", () => {
    const { result } = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=1,2"]) });
    act(() => result.current.addWine(3));
    expect(result.current.selectedIds).toEqual([1, 2, 3]);
  });

  it("addWine is a no-op when the id is already selected", () => {
    const { result } = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=1,2"]) });
    act(() => result.current.addWine(2));
    expect(result.current.selectedIds).toEqual([1, 2]);
  });

  it("addWine is a no-op once 4 are selected", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=1,2,3,4"]),
    });
    act(() => result.current.addWine(5));
    expect(result.current.selectedIds).toEqual([1, 2, 3, 4]);
  });

  it("removeWine drops an id and closes the gap", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=1,2,3"]),
    });
    act(() => result.current.removeWine(2));
    expect(result.current.selectedIds).toEqual([1, 3]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './useCompareSelection'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`frontend/src/hooks/useCompareSelection.ts`:
```typescript
import { useSearchParams } from "react-router-dom";

const MAX_WINES = 4;
const PARAM_KEY = "wines";

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
    if (ids.length === MAX_WINES) break;
  }
  return ids;
}

export function useCompareSelection(): {
  selectedIds: number[];
  addWine: (id: number) => void;
  removeWine: (id: number) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIds = parseIds(searchParams.get(PARAM_KEY));

  function writeIds(ids: number[]) {
    const next = new URLSearchParams(searchParams);
    if (ids.length === 0) {
      next.delete(PARAM_KEY);
    } else {
      next.set(PARAM_KEY, ids.join(","));
    }
    setSearchParams(next, { replace: true });
  }

  function addWine(id: number) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_WINES) return;
    writeIds([...selectedIds, id]);
  }

  function removeWine(id: number) {
    writeIds(selectedIds.filter((existing) => existing !== id));
  }

  return { selectedIds, addWine, removeWine };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test`
Expected: PASS (8 new tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useCompareSelection.ts frontend/src/hooks/useCompareSelection.test.tsx
git commit -m "feat: add useCompareSelection hook for URL-backed wine selection"
```

---

### Task 3: `WineSearchPicker` component

**Files:**
- Create: `frontend/src/components/compare/WineSearchPicker.tsx`
- Test: `frontend/src/components/compare/WineSearchPicker.test.tsx`

**Interfaces:**
- Consumes: `listWines`, `ApiError` (existing, `frontend/src/services/api.ts`); `WineListItem` (existing, `frontend/src/types/wine.ts`); `formatPrice`, `formatVintage` (existing, `frontend/src/utils/format.ts`).
- Produces: `WineSearchPicker({ excludeIds: number[]; onSelect: (id: number) => void })` from `frontend/src/components/compare/WineSearchPicker.tsx` — used by Task 7's `ComparePage`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/compare/WineSearchPicker.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WineSearchPicker } from "./WineSearchPicker";
import * as api from "../../services/api";
import type { WineListItem, WineListResponse } from "../../types/wine";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return { ...actual, listWines: vi.fn() };
});

const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;

function makeItem(id: number, overrides: Partial<WineListItem> = {}): WineListItem {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    grapes: [],
    price: 20,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: null,
    acidity: null,
    tannin: null,
    body: null,
    fruitiness: null,
    ...overrides,
  };
}

describe("WineSearchPicker", () => {
  beforeEach(() => {
    listWinesMock.mockReset();
  });

  it("searches on submit and lists results", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeItem(1)] } satisfies WineListResponse);
    render(<WineSearchPicker excludeIds={[]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "cabernet");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenCalledWith({ q: "cabernet", limit: 8 });
  });

  it("excludes already-selected wines from the results", async () => {
    listWinesMock.mockResolvedValue({ total: 2, items: [makeItem(1), makeItem(2)] });
    render(<WineSearchPicker excludeIds={[2]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.queryByText("Wine 2")).not.toBeInTheDocument();
  });

  it("calls onSelect with the wine's id when a result is clicked", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeItem(7)] });
    const onSelect = vi.fn();
    render(<WineSearchPicker excludeIds={[]} onSelect={onSelect} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText("Wine 7")).toBeInTheDocument());

    await user.click(screen.getByText("Wine 7"));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("shows a no-results message when the search returns nothing", async () => {
    listWinesMock.mockResolvedValue({ total: 0, items: [] });
    render(<WineSearchPicker excludeIds={[]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "nonexistent");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("No wines found.")).toBeInTheDocument());
  });

  it("shows an error message when the search fails", async () => {
    listWinesMock.mockRejectedValueOnce(new Error("network error"));
    render(<WineSearchPicker excludeIds={[]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText(/failed to search wines/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './WineSearchPicker'` (the component doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`frontend/src/components/compare/WineSearchPicker.tsx`:
```typescript
import { useRef, useState, type FormEvent } from "react";
import { ApiError, listWines } from "../../services/api";
import type { WineListItem } from "../../types/wine";
import { formatPrice, formatVintage } from "../../utils/format";

const RESULT_LIMIT = 8;

export function WineSearchPicker({
  excludeIds,
  onSelect,
}: {
  excludeIds: number[];
  onSelect: (id: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<WineListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const requestIdRef = useRef(0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = draft.trim();
    if (!query) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await listWines({ q: query, limit: RESULT_LIMIT });
      if (requestId !== requestIdRef.current) return;
      setResults(response.items);
      setSearched(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof ApiError ? err.message : "Failed to search wines");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }

  const visibleResults = results.filter((wine) => !excludeIds.includes(wine.id));

  return (
    <div className="border border-dashed border-surface-border rounded p-3 flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="compare-search" className="sr-only">
          Search wines to compare
        </label>
        <input
          id="compare-search"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search wine or winery"
          className="flex-1 min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={loading || draft.trim() === ""}
          className="text-sm bg-accent text-surface rounded px-3 py-1 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {error ? <p className="text-sm text-ink-muted">{error}</p> : null}

      {searched && !loading && !error && visibleResults.length === 0 ? (
        <p className="text-sm text-ink-muted">No wines found.</p>
      ) : null}

      {visibleResults.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {visibleResults.map((wine) => (
            <li key={wine.id}>
              <button
                type="button"
                onClick={() => onSelect(wine.id)}
                className="w-full text-left text-sm border border-surface-border rounded px-2 py-1 hover:border-accent"
              >
                <span className="text-ink">{wine.name}</span>{" "}
                <span className="text-ink-muted">
                  &middot; {wine.winery} &middot; {formatVintage(wine.vintage)} &middot;{" "}
                  {formatPrice(wine.price, wine.currency)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test`
Expected: PASS (5 new tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/compare/WineSearchPicker.tsx frontend/src/components/compare/WineSearchPicker.test.tsx
git commit -m "feat: add WineSearchPicker component for the Compare page"
```

---

### Task 4: `CompareSlot` component

**Files:**
- Create: `frontend/src/components/compare/CompareSlot.tsx`
- Test: `frontend/src/components/compare/CompareSlot.test.tsx`

**Interfaces:**
- Consumes: `WineDetail` (existing, `frontend/src/types/wine.ts`); `formatVintage` (existing, `frontend/src/utils/format.ts`).
- Produces: `CompareSlot({ wine: WineDetail; onRemove: () => void })` from `frontend/src/components/compare/CompareSlot.tsx` — used by Task 7's `ComparePage`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/compare/CompareSlot.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompareSlot } from "./CompareSlot";
import type { WineDetail } from "../../types/wine";

function makeWine(overrides: Partial<WineDetail> = {}): WineDetail {
  return {
    id: 1,
    name: "Caymus Cabernet Sauvignon",
    winery: "Caymus Vineyards",
    vintage: 2021,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    subregion: null,
    grapes: [],
    price: 79.99,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: 1,
    acidity: 3,
    tannin: 5,
    body: 5,
    fruitiness: 3,
    abv: 14.6,
    description: null,
    listings: [],
    ...overrides,
  };
}

describe("CompareSlot", () => {
  it("renders the wine's name, winery, and vintage", () => {
    render(<CompareSlot wine={makeWine()} onRemove={vi.fn()} />);
    expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument();
    expect(screen.getByText(/Caymus Vineyards/)).toBeInTheDocument();
    expect(screen.getByText(/2021/)).toBeInTheDocument();
  });

  it("calls onRemove when the remove button is clicked", async () => {
    const onRemove = vi.fn();
    render(<CompareSlot wine={makeWine()} onRemove={onRemove} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove Caymus Cabernet Sauvignon" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("falls back to a placeholder image when image_url is null", () => {
    render(<CompareSlot wine={makeWine({ image_url: null })} onRemove={vi.fn()} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("data:image/svg+xml");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './CompareSlot'` (the component doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`frontend/src/components/compare/CompareSlot.tsx`:
```typescript
import { formatVintage } from "../../utils/format";
import type { WineDetail } from "../../types/wine";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='260'%3E%3Crect width='200' height='260' fill='%232f1b1e'/%3E%3C/svg%3E";

export function CompareSlot({ wine, onRemove }: { wine: WineDetail; onRemove: () => void }) {
  return (
    <div className="relative border border-surface-border rounded overflow-hidden">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${wine.name}`}
        className="absolute top-1.5 right-1.5 bg-surface text-ink-muted hover:text-ink rounded-full w-6 h-6 flex items-center justify-center"
      >
        &times;
      </button>
      <img
        src={wine.image_url ?? PLACEHOLDER_IMAGE}
        alt={wine.name}
        className="w-full h-32 object-cover bg-surface-raised"
      />
      <div className="p-2">
        <h3 className="font-serif text-sm text-ink">{wine.name}</h3>
        <p className="text-xs text-ink-muted">
          {wine.winery} &middot; {formatVintage(wine.vintage)}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test`
Expected: PASS (3 new tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/compare/CompareSlot.tsx frontend/src/components/compare/CompareSlot.test.tsx
git commit -m "feat: add CompareSlot component for the Compare page"
```

---

### Task 5: `CompareTable` component

**Files:**
- Create: `frontend/src/components/compare/CompareTable.tsx`
- Test: `frontend/src/components/compare/CompareTable.test.tsx`

**Interfaces:**
- Consumes: `WineDetail` (existing, `frontend/src/types/wine.ts`); `formatPrice`, `formatApproxUsd`, `hasApproxUsdConversion`, `formatVintage` (existing), `formatGrapeBreakdown` (Task 1) — all from `frontend/src/utils/format.ts`.
- Produces: `CompareTable({ wines: WineDetail[] })` from `frontend/src/components/compare/CompareTable.tsx` — used by Task 7's `ComparePage`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/compare/CompareTable.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompareTable } from "./CompareTable";
import type { WineDetail } from "../../types/wine";

function makeWine(id: number, overrides: Partial<WineDetail> = {}): WineDetail {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    subregion: null,
    grapes: [{ name: "Cabernet Sauvignon", percentage: 100 }],
    price: 20,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: 2,
    acidity: 3,
    tannin: 4,
    body: 5,
    fruitiness: 1,
    abv: 13.5,
    description: null,
    listings: [],
    ...overrides,
  };
}

describe("CompareTable", () => {
  it("renders a column per wine with its name in the header", () => {
    render(<CompareTable wines={[makeWine(1), makeWine(2, { name: "Wine 2" })]} />);
    expect(screen.getByRole("columnheader", { name: "Wine 1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Wine 2" })).toBeInTheDocument();
  });

  it("renders formatted values for winery, vintage, price, and grapes", () => {
    render(<CompareTable wines={[makeWine(1), makeWine(2)]} />);
    expect(screen.getAllByText("Test Winery")).toHaveLength(2);
    expect(screen.getAllByText("2020")).toHaveLength(2);
    expect(screen.getAllByText("$20.00")).toHaveLength(2);
    expect(screen.getAllByText("Cabernet Sauvignon (100%)")).toHaveLength(2);
  });

  it("shows 'Not rated' for a null characteristic", () => {
    render(<CompareTable wines={[makeWine(1, { tannin: null }), makeWine(2)]} />);
    expect(screen.getByText("Not rated")).toBeInTheDocument();
  });

  it("shows 'Not listed' for a null ABV", () => {
    render(<CompareTable wines={[makeWine(1, { abv: null }), makeWine(2)]} />);
    expect(screen.getByText("Not listed")).toBeInTheDocument();
  });

  it("shows an approx-USD line for a non-USD priced wine", () => {
    render(
      <CompareTable wines={[makeWine(1, { price: 50, currency: "EUR", price_usd_approx: 54 }), makeWine(2)]} />
    );
    expect(screen.getByText("€50.00")).toBeInTheDocument();
    expect(screen.getByText("≈ $54.00 USD")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './CompareTable'` (the component doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`frontend/src/components/compare/CompareTable.tsx`:
```typescript
import type { WineDetail } from "../../types/wine";
import {
  formatPrice,
  formatApproxUsd,
  hasApproxUsdConversion,
  formatVintage,
  formatGrapeBreakdown,
} from "../../utils/format";

const CHARACTERISTIC_MAX = 5;

const CHARACTERISTIC_ROWS: {
  label: string;
  key: "sweetness" | "acidity" | "tannin" | "body" | "fruitiness";
}[] = [
  { label: "Sweetness", key: "sweetness" },
  { label: "Acidity", key: "acidity" },
  { label: "Tannin", key: "tannin" },
  { label: "Body", key: "body" },
  { label: "Fruitiness", key: "fruitiness" },
];

function CharacteristicCell({ value }: { value: number | null }) {
  const percent = value === null ? 0 : (value / CHARACTERISTIC_MAX) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-ink-muted w-16 text-right">{value === null ? "Not rated" : `${value}/5`}</span>
    </div>
  );
}

const ROW_LABEL_CLASS = "text-left text-ink-muted font-normal p-2 align-top";
const CELL_CLASS = "p-2 text-ink align-top";

export function CompareTable({ wines }: { wines: WineDetail[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm border-collapse">
        <thead>
          <tr>
            <th className={ROW_LABEL_CLASS}>Field</th>
            {wines.map((wine) => (
              <th key={wine.id} className="text-left text-ink font-serif p-2">
                {wine.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Winery
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.winery}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Vintage
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {formatVintage(wine.vintage)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Type
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.type}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Country
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.country ?? "Unknown"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Region
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {[wine.region, wine.subregion].filter(Boolean).join(", ") || "Unknown"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Grape(s)
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {formatGrapeBreakdown(wine.grapes)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Price
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {formatPrice(wine.price, wine.currency)}
                {hasApproxUsdConversion(wine.currency, wine.price_usd_approx) ? (
                  <span className="block text-xs text-ink-muted">{formatApproxUsd(wine.price_usd_approx)}</span>
                ) : null}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              ABV
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.abv === null ? "Not listed" : `${wine.abv}%`}
              </td>
            ))}
          </tr>
          {CHARACTERISTIC_ROWS.map((row) => (
            <tr key={row.key} className="border-t border-surface-border">
              <th scope="row" className={ROW_LABEL_CLASS}>
                {row.label}
              </th>
              {wines.map((wine) => (
                <td key={wine.id} className="p-2 align-top">
                  <CharacteristicCell value={wine[row.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test`
Expected: PASS (5 new tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/compare/CompareTable.tsx frontend/src/components/compare/CompareTable.test.tsx
git commit -m "feat: add CompareTable component"
```

---

### Task 6: `recharts` dependency and `CompareRadarChart` component

**Files:**
- Modify: `frontend/package.json` (and `frontend/package-lock.json`, regenerated by `npm install`)
- Create: `frontend/src/components/compare/CompareRadarChart.tsx`
- Test: `frontend/src/components/compare/CompareRadarChart.test.tsx`

**Interfaces:**
- Consumes: `WineDetail` (existing, `frontend/src/types/wine.ts`); `RadarChart`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `Radar`, `Legend`, `Tooltip` (new, from the `recharts` package).
- Produces: `CompareRadarChart({ wines: WineDetail[] })` from `frontend/src/components/compare/CompareRadarChart.tsx` — used by Task 7's `ComparePage`.

**Palette note:** the 4 series colors below (`#3987e5` blue, `#d95926` orange, `#199e70` aqua, `#9085e9` violet) are the dataviz skill's default dark-step categorical hues. They were run through `node scripts/validate_palette.js` (from the dataviz skill's directory) against all three VinoScope theme surfaces (`#231416`, `#1c1c1e`, `#f5efe6`): the first 3 slots pass every check (all-pairs CVD and normal-vision floors) on all three surfaces, with only a contrast WARN on the light surface (mitigated by the always-visible Legend labels, satisfying the skill's relief rule). No 4-color ordering clears the all-pairs CVD floor — this is a documented limitation of the reference palette, not a mistake — so the 4th wine's series additionally gets a distinct `strokeDasharray`, and *every* series gets a distinct dash pattern (not just the 4th), so identity never depends on hue alone for any pair.

- [ ] **Step 1: Add the `recharts` dependency**

Run: `cd frontend && npm install recharts@^3.10.1`
Expected: `frontend/package.json`'s `dependencies` gains `"recharts": "^3.10.1"` and `frontend/package-lock.json` updates. Commit this alongside Step 5 below (it's one change with the component that uses it).

- [ ] **Step 2: Write the failing test**

`frontend/src/components/compare/CompareRadarChart.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompareRadarChart } from "./CompareRadarChart";
import type { WineDetail } from "../../types/wine";

function makeWine(id: number, overrides: Partial<WineDetail> = {}): WineDetail {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    subregion: null,
    grapes: [],
    price: 20,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: 2,
    acidity: 3,
    tannin: 4,
    body: 5,
    fruitiness: 1,
    abv: 13.5,
    description: null,
    listings: [],
    ...overrides,
  };
}

describe("CompareRadarChart", () => {
  it("renders a legend entry for each wine", () => {
    render(<CompareRadarChart wines={[makeWine(1), makeWine(2, { name: "Wine 2" })]} />);
    expect(screen.getByText("Wine 1")).toBeInTheDocument();
    expect(screen.getByText("Wine 2")).toBeInTheDocument();
  });

  it("does not show the missing-value caption when every wine has all five characteristics", () => {
    render(<CompareRadarChart wines={[makeWine(1), makeWine(2)]} />);
    expect(screen.queryByText(/plotted as 0/i)).not.toBeInTheDocument();
  });

  it("shows the missing-value caption when a wine is missing a characteristic", () => {
    render(<CompareRadarChart wines={[makeWine(1, { tannin: null }), makeWine(2)]} />);
    expect(screen.getByText(/plotted as 0/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './CompareRadarChart'` (the component doesn't exist yet).

- [ ] **Step 4: Write the implementation**

`frontend/src/components/compare/CompareRadarChart.tsx`:
```typescript
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts";
import type { WineDetail } from "../../types/wine";

const AXES: { key: "sweetness" | "acidity" | "tannin" | "body" | "fruitiness"; label: string }[] = [
  { key: "sweetness", label: "Sweetness" },
  { key: "acidity", label: "Acidity" },
  { key: "tannin", label: "Tannin" },
  { key: "body", label: "Body" },
  { key: "fruitiness", label: "Fruitiness" },
];

const SERIES: { color: string; dash?: string }[] = [
  { color: "#3987e5" },
  { color: "#d95926", dash: "6 3" },
  { color: "#199e70", dash: "2 2" },
  { color: "#9085e9", dash: "8 3 2 3" },
];

const NEUTRAL_CHROME_COLOR = "#8a8a8e";

const TOOLTIP_STYLE = {
  backgroundColor: "#231416",
  border: "1px solid #4a262b",
  borderRadius: 4,
  color: "#e8dcc8",
  fontSize: 12,
};

function seriesKey(wineId: number): string {
  return `wine_${wineId}`;
}

function buildRadarData(wines: WineDetail[]): Record<string, string | number>[] {
  return AXES.map((axis) => {
    const row: Record<string, string | number> = { characteristic: axis.label };
    for (const wine of wines) {
      row[seriesKey(wine.id)] = wine[axis.key] ?? 0;
    }
    return row;
  });
}

export function CompareRadarChart({ wines }: { wines: WineDetail[] }) {
  const data = buildRadarData(wines);
  const hasMissingValue = wines.some((wine) => AXES.some((axis) => wine[axis.key] === null));

  return (
    <div className="flex flex-col items-center gap-2 text-ink">
      <RadarChart width={320} height={320} data={data} outerRadius="70%">
        <PolarGrid stroke={NEUTRAL_CHROME_COLOR} />
        <PolarAngleAxis dataKey="characteristic" tick={{ fill: NEUTRAL_CHROME_COLOR, fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
        {wines.map((wine, index) => {
          const series = SERIES[index];
          return (
            <Radar
              key={wine.id}
              name={wine.name}
              dataKey={seriesKey(wine.id)}
              stroke={series.color}
              strokeDasharray={series.dash}
              strokeWidth={2}
              fill={series.color}
              fillOpacity={0.15}
            />
          );
        })}
        <Legend />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
      {hasMissingValue ? <p className="text-xs text-ink-muted">Missing characteristics are plotted as 0.</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm run test`
Expected: PASS (3 new tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json \
  frontend/src/components/compare/CompareRadarChart.tsx frontend/src/components/compare/CompareRadarChart.test.tsx
git commit -m "feat: add CompareRadarChart component"
```

---

### Task 7: `ComparePage`, routing, and verification

**Files:**
- Create: `frontend/src/pages/ComparePage.tsx`
- Test: `frontend/src/pages/ComparePage.test.tsx`
- Modify: `frontend/src/pages/StubPages.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `getWine`, `ApiError` (existing, `services/api.ts`); `useCompareSelection` (Task 2); `WineSearchPicker` (Task 3); `CompareSlot` (Task 4); `CompareTable` (Task 5); `CompareRadarChart` (Task 6); `Skeleton` (existing, `components/common/Skeleton.tsx`); `WineDetail` (existing, `types/wine.ts`).
- Produces: `ComparePage` wired into `App.tsx` at `/compare`, replacing the stub.

- [ ] **Step 1: Write the failing tests**

`frontend/src/pages/ComparePage.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ComparePage } from "./ComparePage";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import type { WineDetail, WineListResponse } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getWine: vi.fn(), listWines: vi.fn() };
});

const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;
const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;

function makeWine(id: number, overrides: Partial<WineDetail> = {}): WineDetail {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    subregion: null,
    grapes: [],
    price: 20,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: 2,
    acidity: 3,
    tannin: 4,
    body: 5,
    fruitiness: 1,
    abv: 13.5,
    description: null,
    listings: [],
    ...overrides,
  };
}

function renderPage(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ComparePage />
    </MemoryRouter>
  );
}

describe("ComparePage", () => {
  beforeEach(() => {
    getWineMock.mockReset();
    listWinesMock.mockReset();
  });

  it("shows a prompt instead of the table when fewer than 2 wines are selected", () => {
    renderPage(["/compare"]);
    expect(screen.getByText("Add at least 2 wines to compare.")).toBeInTheDocument();
  });

  it("loads wines from the URL and renders the table once 2+ are loaded", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2"]);

    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));
    expect(getWineMock).toHaveBeenCalledWith(1);
    expect(getWineMock).toHaveBeenCalledWith(2);
    expect(screen.queryByText("Add at least 2 wines to compare.")).not.toBeInTheDocument();
  });

  it("adding a wine via the picker updates the selection and fetches it", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    listWinesMock.mockResolvedValue({
      total: 1,
      items: [{ ...makeWine(9), grapes: [] }],
    } as unknown as WineListResponse);
    renderPage(["/compare?wines=1,2"]);
    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText("Wine 9")).toBeInTheDocument());
    await user.click(screen.getByText("Wine 9"));

    await waitFor(() => expect(getWineMock).toHaveBeenCalledWith(9));
  });

  it("removing a wine drops it from the comparison", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2"]);
    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove Wine 1" }));

    await waitFor(() => expect(screen.getByText("Add at least 2 wines to compare.")).toBeInTheDocument());
    expect(screen.queryByText("Remove Wine 1")).not.toBeInTheDocument();
  });

  it("shows an inline error for a single failed wine without breaking the others", async () => {
    getWineMock.mockImplementation((id: number) =>
      id === 1 ? Promise.reject(new ApiError(404, "Wine not found")) : Promise.resolve(makeWine(id))
    );
    renderPage(["/compare?wines=1,2"]);

    await waitFor(() => expect(screen.getByText("Wine not found")).toBeInTheDocument());
    expect(screen.getAllByText("Wine 2").length).toBeGreaterThan(0);
  });

  it("always shows 4 slots total: filled, the picker, and inert placeholders", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2"]);
    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));

    expect(screen.getByLabelText("Search wines to compare")).toBeInTheDocument();
    expect(screen.getAllByText("Empty slot")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './ComparePage'` (the page doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`frontend/src/pages/ComparePage.tsx`:
```typescript
import { useEffect, useRef, useState } from "react";
import { ApiError, getWine } from "../services/api";
import { useCompareSelection } from "../hooks/useCompareSelection";
import { WineSearchPicker } from "../components/compare/WineSearchPicker";
import { CompareSlot } from "../components/compare/CompareSlot";
import { CompareTable } from "../components/compare/CompareTable";
import { CompareRadarChart } from "../components/compare/CompareRadarChart";
import { Skeleton } from "../components/common/Skeleton";
import type { WineDetail } from "../types/wine";

const MAX_SLOTS = 4;

interface SlotState {
  status: "loading" | "error" | "loaded";
  wine?: WineDetail;
  error?: string;
}

export function ComparePage() {
  const { selectedIds, addWine, removeWine } = useCompareSelection();
  const [wineStates, setWineStates] = useState<Record<number, SlotState>>({});
  const requestIdsRef = useRef<Record<number, number>>({});

  useEffect(() => {
    for (const id of selectedIds) {
      if (wineStates[id]) continue;
      const requestId = (requestIdsRef.current[id] ?? 0) + 1;
      requestIdsRef.current[id] = requestId;
      setWineStates((prev) => ({ ...prev, [id]: { status: "loading" } }));
      getWine(id)
        .then((wine) => {
          if (requestIdsRef.current[id] !== requestId) return;
          setWineStates((prev) => ({ ...prev, [id]: { status: "loaded", wine } }));
        })
        .catch((err) => {
          if (requestIdsRef.current[id] !== requestId) return;
          const message = err instanceof ApiError ? err.message : "Failed to load this wine";
          setWineStates((prev) => ({ ...prev, [id]: { status: "error", error: message } }));
        });
    }

    for (const idStr of Object.keys(wineStates)) {
      const id = Number(idStr);
      if (selectedIds.includes(id)) continue;
      delete requestIdsRef.current[id];
      setWineStates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const loadedWines = selectedIds
    .map((id) => wineStates[id])
    .filter((state): state is SlotState & { wine: WineDetail } => state?.status === "loaded" && !!state.wine)
    .map((state) => state.wine);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl text-ink">Compare</h1>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {selectedIds.map((id) => {
          const state = wineStates[id];
          if (!state || state.status === "loading") {
            return <Skeleton key={id} className="w-full h-48" />;
          }
          if (state.status === "error") {
            return (
              <div key={id} className="border border-surface-border rounded p-3 flex flex-col gap-2">
                <p className="text-sm text-ink-muted">{state.error}</p>
                <button type="button" onClick={() => removeWine(id)} className="text-sm text-accent hover:underline">
                  Remove
                </button>
              </div>
            );
          }
          return <CompareSlot key={id} wine={state.wine as WineDetail} onRemove={() => removeWine(id)} />;
        })}
        {selectedIds.length < MAX_SLOTS ? (
          <WineSearchPicker key={selectedIds.length} excludeIds={selectedIds} onSelect={addWine} />
        ) : null}
        {Array.from({
          length: Math.max(0, MAX_SLOTS - selectedIds.length - (selectedIds.length < MAX_SLOTS ? 1 : 0)),
        }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="border border-dashed border-surface-border rounded p-3 opacity-50 flex items-center justify-center text-sm text-ink-muted h-48"
          >
            Empty slot
          </div>
        ))}
      </div>

      {loadedWines.length < 2 ? (
        <p className="text-ink-muted text-center py-8">Add at least 2 wines to compare.</p>
      ) : (
        <>
          <CompareTable wines={loadedWines} />
          <CompareRadarChart wines={loadedWines} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire `ComparePage` into routing**

In `frontend/src/pages/StubPages.tsx`, delete the `ComparePage` export (keep the `StubPage` import and `LearnPage`). The file should read in full:
```typescript
import { StubPage } from "../components/common/StubPage";

export function LearnPage() {
  return (
    <StubPage
      title="Learn"
      description="Learn will cover the basics behind the terms used across the site: grape varieties, wine regions, and concepts like tannin, acidity, body, and terroir. This page doesn't have real content yet."
    />
  );
}
```

In `frontend/src/App.tsx`, replace the import lines and the `/compare` route:
```typescript
import { Routes, Route } from "react-router-dom";
import { PageShell } from "./components/layout/PageShell";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { WineDetailPage } from "./pages/WineDetailPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { AdminPage } from "./pages/AdminPage";
import { PairPage } from "./pages/PairPage";
import { ComparePage } from "./pages/ComparePage";
import { LearnPage } from "./pages/StubPages";

export function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/wines/:id" element={<WineDetailPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pair" element={<PairPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/learn" element={<LearnPage />} />
      </Routes>
    </PageShell>
  );
}
```

In `frontend/src/App.test.tsx`, replace the stub-page test:
```typescript
  it("renders the Compare stub page at /compare", () => {
    renderAt("/compare");
    expect(screen.getByRole("heading", { name: "Compare" })).toBeInTheDocument();
  });
```
with:
```typescript
  it("renders the Compare page at /compare", () => {
    renderAt("/compare");
    expect(screen.getByRole("heading", { name: "Compare" })).toBeInTheDocument();
  });
```
(everything else in `App.test.tsx`, including the nav-link test, is unchanged — `/compare` already routes and links correctly).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (all tests, including 6 new `ComparePage` tests and the updated `App.test.tsx`).

- [ ] **Step 6: Run the production build**

Run: `cd frontend && npm run build`
Expected: Succeeds with no TypeScript errors.

- [ ] **Step 7: Manually verify the full flow against real data**

```bash
cd backend
uvicorn app.main:app --port 8000 &
cd ..
cd frontend
npm run dev -- --port 5173 &
cd ..
sleep 3
curl -s -o /dev/null -w "wines list status: %{http_code}\n" "http://localhost:8000/api/wines?limit=2"
curl -s -o /dev/null -w "frontend status: %{http_code}\n" http://localhost:5173
kill %1 %2
```
Confirm both status codes are `200`. Then, with both servers running, open `http://localhost:5173/compare` in a browser and confirm by hand: the page starts with an empty picker and the "Add at least 2 wines to compare" prompt; searching for a real wine name/winery from the dataset and selecting two results shows both in slots and renders the table and radar chart; removing one wine drops it and the table/chart disappear again below 2; reloading the page after selecting wines (copy the `?wines=...` URL) restores the same selection; the layout doesn't overflow horizontally at a narrow (~375px) browser width, with the table scrolling within its own container instead. This visual check cannot be automated by `curl` — do it before considering this task done.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/ComparePage.tsx frontend/src/pages/ComparePage.test.tsx \
  frontend/src/pages/StubPages.tsx frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: add Compare page with side-by-side wine comparison and radar chart, plus routing"
```
