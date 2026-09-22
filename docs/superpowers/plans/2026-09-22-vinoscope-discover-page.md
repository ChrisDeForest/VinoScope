# VinoScope Discover Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Discover page — a preference questionnaire that calls the existing `POST /api/recommendations` endpoint and displays ranked, explained results — replacing the current `/discover` stub.

**Architecture:** A single-page form/results state machine in `DiscoverPage`, built from new presentational components under `components/discover/`, a widened `WineCard`/`WineGrid` shared with Explore, and a new `getRecommendations` API client function. No backend changes.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS — same as the rest of the frontend. No new dependencies.

## Global Constraints

- No new runtime dependencies.
- The five dimension labels shown in the questionnaire must exactly match the backend's `LABELS` table in `backend/app/services/recommendations.py` (sweetness: Very dry/Dry/Off-dry/Sweet/Very sweet; acidity: Low/Medium-low/Medium/Medium-high/High acidity; tannin: Low/Medium-low/Medium/Medium-high/High tannin; body: Very light-bodied/Light-bodied/Medium-bodied/Full-bodied/Very full-bodied; fruitiness: Subtle/Light/Moderate/Fruit-forward/Very fruit-forward fruit).
- "I'm unsure" always means the field is omitted from the request object entirely — never sent as `null`, never defaulted to a value.
- `WineCard`'s existing Explore behavior must be unchanged when `matchScore`/`explanation` are not passed — both are optional props.
- Tests use Vitest + React Testing Library; the API layer (`src/services/api.ts`) is mocked at the test boundary, matching every other frontend page test in this codebase.
- Mobile-responsive down to phone width.

---

### Task 1: Shared option constants, types, and API client

**Files:**
- Create: `frontend/src/constants/wineOptions.ts`
- Modify: `frontend/src/components/explore/FilterDrawer.tsx`
- Modify: `frontend/src/types/wine.ts`
- Modify: `frontend/src/services/api.ts`
- Test (modify): `frontend/src/services/api.test.ts`

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `TYPE_OPTIONS`, `TYPE_LABELS`, `COUNTRY_OPTIONS` from `frontend/src/constants/wineOptions.ts` (reused by Task 3's `DiscoverForm`). `RecommendationAnswers`, `RecommendationRequest`, `RecommendationItem`, `RecommendationResponse` types from `frontend/src/types/wine.ts`. `getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse>` from `frontend/src/services/api.ts` — reused by Task 4's `DiscoverPage`.

- [ ] **Step 1: Extract the shared option constants**

`frontend/src/constants/wineOptions.ts`:
```typescript
export const TYPE_OPTIONS = ["", "red", "white", "rosé", "sparkling", "fortified"];

export const TYPE_LABELS: Record<string, string> = {
  "": "All types",
  red: "Red",
  white: "White",
  rosé: "Rosé",
  sparkling: "Sparkling",
  fortified: "Fortified",
};

export const COUNTRY_OPTIONS = [
  "",
  "Argentina",
  "Australia",
  "Chile",
  "France",
  "Germany",
  "Italy",
  "New Zealand",
  "Portugal",
  "Spain",
  "United States",
];
```

In `frontend/src/components/explore/FilterDrawer.tsx`, delete lines 5–27 (the `TYPE_OPTIONS`, `TYPE_LABELS`, and `COUNTRY_OPTIONS` declarations) and replace them with an import, so the top of the file reads:
```typescript
import { useEffect, useRef, useState } from "react";
import type { SortOption } from "../../types/wine";
import { DEFAULT_FILTERS, type FilterValues } from "./filterTypes";
import { TYPE_OPTIONS, TYPE_LABELS, COUNTRY_OPTIONS } from "../../constants/wineOptions";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "winery", label: "Winery (A-Z)" },
```
(the rest of the file — `SORT_OPTIONS` onward — is unchanged). Run `cd frontend && npm run test` after this change to confirm `FilterDrawer.test.tsx` and `ExplorePage.test.tsx` still pass unchanged — this is a pure refactor, no behavior change.

- [ ] **Step 2: Add the recommendation types**

Append to `frontend/src/types/wine.ts`:
```typescript
export interface RecommendationAnswers {
  sweetness?: number;
  acidity?: number;
  tannin?: number;
  body?: number;
  fruitiness?: number;
  type?: string;
  country?: string;
  min_price?: number;
  max_price?: number;
}

export interface RecommendationRequest extends RecommendationAnswers {
  limit?: number;
  offset?: number;
}

export interface RecommendationItem extends WineListItem {
  match_score: number;
  explanation: string[];
}

export interface RecommendationResponse {
  profile: { description: string[] };
  total: number;
  items: RecommendationItem[];
}
```

- [ ] **Step 3: Write the failing test for the API client addition**

Add `getRecommendations` to the import line at the top of `frontend/src/services/api.test.ts`:
```typescript
import { listWines, getWine, getRecommendations, ApiError } from "./api";
```

Append this `describe` block to the end of the file:
```typescript
describe("getRecommendations", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts the request as JSON and returns parsed JSON", async () => {
    const mockResponse = { profile: { description: [] }, total: 0, items: [] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockResponse });

    const result = await getRecommendations({ type: "red", sweetness: 1 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/recommendations"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "red", sweetness: 1 }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws ApiError on a non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(getRecommendations({})).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `getRecommendations` is not exported from `./api` yet.

- [ ] **Step 5: Implement `getRecommendations`**

In `frontend/src/services/api.ts`, update the import line to add the new types:
```typescript
import type {
  ListWinesParams,
  RecommendationRequest,
  RecommendationResponse,
  WineDetail,
  WineListResponse,
} from "../types/wine";
```

Append this function at the end of the file:
```typescript
export async function getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load recommendations (${response.status})`);
  }
  return response.json();
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (53 tests — 51 existing plus 2 new `getRecommendations` tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/constants frontend/src/components/explore/FilterDrawer.tsx \
  frontend/src/types/wine.ts frontend/src/services/api.ts frontend/src/services/api.test.ts
git commit -m "refactor: extract shared wine option constants, add recommendation API client"
```

---

### Task 2: `WineCard`/`WineGrid` match-score and explanation support

**Files:**
- Modify: `frontend/src/components/wine/WineCard.tsx`
- Modify: `frontend/src/components/wine/WineGrid.tsx`
- Test (modify): `frontend/src/components/wine/WineCard.test.tsx`, `frontend/src/components/wine/WineGrid.test.tsx`

**Interfaces:**
- Consumes: nothing new (extends existing Task 4-of-Explore-plan components).
- Produces: `WineCard` accepting optional `matchScore?: number` and `explanation?: string[]` props; `WineGrid` accepting items that optionally carry `match_score`/`explanation` and passing them through. Reused by Task 4's `DiscoverPage`.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/wine/WineCard.test.tsx`, replace the existing `renderCard` helper with one that accepts optional extra props:
```typescript
function renderCard(wine: WineListItem, extra: { matchScore?: number; explanation?: string[] } = {}) {
  render(
    <MemoryRouter>
      <WineCard wine={wine} matchScore={extra.matchScore} explanation={extra.explanation} />
    </MemoryRouter>
  );
}
```

Append these tests to the `describe("WineCard", ...)` block:
```typescript
  it("renders a match score badge when matchScore is provided", () => {
    renderCard(baseWine, { matchScore: 0.92 });
    expect(screen.getByText("92% Match")).toBeInTheDocument();
  });

  it("does not render a match score badge when matchScore is not provided", () => {
    renderCard(baseWine);
    expect(screen.queryByText(/% Match/)).not.toBeInTheDocument();
  });

  it("renders up to 3 explanation items joined by a middot", () => {
    renderCard(baseWine, {
      explanation: ["High tannin", "Full-bodied", "Within your price range", "Extra reason"],
    });
    expect(screen.getByText("High tannin · Full-bodied · Within your price range")).toBeInTheDocument();
  });

  it("does not render an explanation line when explanation is not provided", () => {
    renderCard(baseWine);
    expect(screen.queryByText(/High tannin/)).not.toBeInTheDocument();
  });
```

In `frontend/src/components/wine/WineGrid.test.tsx`, append to the `describe("WineGrid", ...)` block:
```typescript
  it("passes match_score and explanation through to WineCard", () => {
    render(
      <MemoryRouter>
        <WineGrid wines={[{ ...wine(1), match_score: 0.75, explanation: ["Full-bodied"] }]} />
      </MemoryRouter>
    );
    expect(screen.getByText("75% Match")).toBeInTheDocument();
    expect(screen.getByText("Full-bodied")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — the new `WineCard`/`WineGrid` tests fail because the props don't exist yet (no badge or explanation line renders).

- [ ] **Step 3: Implement the `WineCard` extension**

Replace `frontend/src/components/wine/WineCard.tsx` in full:
```typescript
import { Link } from "react-router-dom";
import type { WineListItem } from "../../types/wine";
import { formatPrice, formatVintage, primaryGrapeLabel } from "../../utils/format";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='260'%3E%3Crect width='200' height='260' fill='%232f1b1e'/%3E%3C/svg%3E";

export function WineCard({
  wine,
  matchScore,
  explanation,
}: {
  wine: WineListItem;
  matchScore?: number;
  explanation?: string[];
}) {
  return (
    <Link
      to={`/wines/${wine.id}`}
      className="block border border-surface-border rounded overflow-hidden hover:border-accent"
    >
      <div className="relative">
        <img
          src={wine.image_url ?? PLACEHOLDER_IMAGE}
          alt={wine.name}
          className="w-full h-48 object-cover bg-surface-raised"
        />
        {matchScore !== undefined ? (
          <span className="absolute top-1.5 right-1.5 bg-accent text-surface text-xs font-bold px-2 py-0.5 rounded-full">
            {Math.round(matchScore * 100)}% Match
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <span className="inline-block text-xs uppercase tracking-wide text-accent mb-1">{wine.type}</span>
        <h3 className="font-serif text-base text-ink">{wine.name}</h3>
        <p className="text-sm text-ink-muted">
          {wine.winery} &middot; {formatVintage(wine.vintage)}
        </p>
        <p className="text-sm text-ink-muted">{[wine.region, wine.country].filter(Boolean).join(", ")}</p>
        <p className="text-sm text-ink-muted">{primaryGrapeLabel(wine.grapes)}</p>
        <p className="text-sm font-semibold text-ink mt-1">{formatPrice(wine.price)}</p>
        {explanation && explanation.length > 0 ? (
          <p className="text-xs text-ink-muted mt-1">{explanation.slice(0, 3).join(" · ")}</p>
        ) : null}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Implement the `WineGrid` extension**

Replace `frontend/src/components/wine/WineGrid.tsx` in full:
```typescript
import type { WineListItem } from "../../types/wine";
import { WineCard } from "./WineCard";
import { WineCardSkeleton } from "../common/Skeleton";

type GridItem = WineListItem & { match_score?: number; explanation?: string[] };

export function WineGrid({ wines, skeletonCount = 0 }: { wines: GridItem[]; skeletonCount?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {wines.map((wine) => (
        <WineCard key={wine.id} wine={wine} matchScore={wine.match_score} explanation={wine.explanation} />
      ))}
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <WineCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (58 tests — 53 from Task 1 plus 4 new `WineCard` tests plus 1 new `WineGrid` test)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/wine/WineCard.tsx frontend/src/components/wine/WineGrid.tsx \
  frontend/src/components/wine/WineCard.test.tsx frontend/src/components/wine/WineGrid.test.tsx
git commit -m "feat: add match score badge and explanation to WineCard/WineGrid"
```

---

### Task 3: Questionnaire components

**Files:**
- Create: `frontend/src/utils/dimensionLabels.ts`
- Create: `frontend/src/utils/discoverProfile.ts`
- Create: `frontend/src/components/discover/DimensionField.tsx`
- Create: `frontend/src/components/discover/DiscoverForm.tsx`
- Create: `frontend/src/components/discover/ProfileSummary.tsx`
- Test: `frontend/src/utils/discoverProfile.test.ts`, `frontend/src/components/discover/DimensionField.test.tsx`, `frontend/src/components/discover/DiscoverForm.test.tsx`, `frontend/src/components/discover/ProfileSummary.test.tsx`

**Interfaces:**
- Consumes: `RecommendationAnswers` type, `TYPE_OPTIONS`/`TYPE_LABELS`/`COUNTRY_OPTIONS` (Task 1).
- Produces: `DIMENSIONS`, `Dimension` type, `DIMENSION_LABELS`, `DIMENSION_TITLES` (`utils/dimensionLabels.ts`); `getStoredProfile()`/`setStoredProfile()` (`utils/discoverProfile.ts`); `DiscoverForm`, `ProfileSummary` components — all reused by Task 4's `DiscoverPage`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/utils/discoverProfile.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getStoredProfile, setStoredProfile } from "./discoverProfile";

describe("discoverProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getStoredProfile()).toBeNull();
  });

  it("round-trips a profile through set and get", () => {
    setStoredProfile({ type: "red", sweetness: 1 });
    expect(getStoredProfile()).toEqual({ type: "red", sweetness: 1 });
  });

  it("returns null for corrupted stored data instead of throwing", () => {
    localStorage.setItem("vinoscope-discover-profile", "{not valid json");
    expect(getStoredProfile()).toBeNull();
  });
});
```

`frontend/src/components/discover/DimensionField.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DimensionField } from "./DimensionField";

describe("DimensionField", () => {
  it("renders all 5 levels plus an 'I'm unsure' option", () => {
    render(<DimensionField dimension="sweetness" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Very dry")).toBeInTheDocument();
    expect(screen.getByLabelText("Very sweet")).toBeInTheDocument();
    expect(screen.getByLabelText("I'm unsure")).toBeInTheDocument();
  });

  it("defaults to 'I'm unsure' selected when value is undefined", () => {
    render(<DimensionField dimension="sweetness" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByLabelText("I'm unsure")).toBeChecked();
  });

  it("calls onChange with the level when a level is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionField dimension="tannin" value={undefined} onChange={onChange} />);
    await user.click(screen.getByLabelText("High tannin"));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("calls onChange with undefined when 'I'm unsure' is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionField dimension="tannin" value={5} onChange={onChange} />);
    await user.click(screen.getByLabelText("I'm unsure"));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
```

`frontend/src/components/discover/ProfileSummary.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSummary } from "./ProfileSummary";

describe("ProfileSummary", () => {
  it("renders each description line", () => {
    render(<ProfileSummary description={["Very dry", "Full-bodied"]} />);
    expect(screen.getByText("Very dry")).toBeInTheDocument();
    expect(screen.getByText("Full-bodied")).toBeInTheDocument();
  });

  it("shows a fallback message when description is empty", () => {
    render(<ProfileSummary description={[]} />);
    expect(screen.getByText(/no specific preferences set/i)).toBeInTheDocument();
  });
});
```

`frontend/src/components/discover/DiscoverForm.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscoverForm } from "./DiscoverForm";

describe("DiscoverForm", () => {
  it("pre-fills from initialAnswers", () => {
    render(<DiscoverForm initialAnswers={{ type: "red", sweetness: 1 }} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Wine type")).toHaveValue("red");
    expect(screen.getByLabelText("Very dry")).toBeChecked();
  });

  it("submits the current draft answers, including edits made after mount", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DiscoverForm initialAnswers={{}} onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText("Wine type"), "red");
    await user.click(screen.getByLabelText("High tannin"));
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "red", tannin: 5 }));
  });

  it("omits a dimension from the submitted answers when left on 'I'm unsure'", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DiscoverForm initialAnswers={{}} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.sweetness).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './discoverProfile'`, `'./DimensionField'`, `'./ProfileSummary'`, `'./DiscoverForm'`.

- [ ] **Step 3: Implement the dimension labels and localStorage helpers**

`frontend/src/utils/dimensionLabels.ts`:
```typescript
export const DIMENSION_LABELS: Record<string, Record<number, string>> = {
  sweetness: { 1: "Very dry", 2: "Dry", 3: "Off-dry", 4: "Sweet", 5: "Very sweet" },
  acidity: {
    1: "Low acidity",
    2: "Medium-low acidity",
    3: "Medium acidity",
    4: "Medium-high acidity",
    5: "High acidity",
  },
  tannin: {
    1: "Low tannin",
    2: "Medium-low tannin",
    3: "Medium tannin",
    4: "Medium-high tannin",
    5: "High tannin",
  },
  body: {
    1: "Very light-bodied",
    2: "Light-bodied",
    3: "Medium-bodied",
    4: "Full-bodied",
    5: "Very full-bodied",
  },
  fruitiness: {
    1: "Subtle fruit",
    2: "Light fruit",
    3: "Moderate fruit",
    4: "Fruit-forward",
    5: "Very fruit-forward",
  },
};

export const DIMENSION_TITLES: Record<string, string> = {
  sweetness: "Sweetness",
  acidity: "Acidity",
  tannin: "Tannin",
  body: "Body",
  fruitiness: "Fruit Intensity",
};

export const DIMENSIONS = ["sweetness", "acidity", "tannin", "body", "fruitiness"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
```

`frontend/src/utils/discoverProfile.ts`:
```typescript
import type { RecommendationAnswers } from "../types/wine";

const STORAGE_KEY = "vinoscope-discover-profile";

export function getStoredProfile(): RecommendationAnswers | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RecommendationAnswers;
  } catch {
    return null;
  }
}

export function setStoredProfile(answers: RecommendationAnswers): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // localStorage unavailable — the profile just won't persist this session
  }
}
```

- [ ] **Step 4: Implement `DimensionField` and `ProfileSummary`**

`frontend/src/components/discover/DimensionField.tsx`:
```typescript
import { DIMENSION_LABELS, DIMENSION_TITLES, type Dimension } from "../../utils/dimensionLabels";

const LEVELS = [1, 2, 3, 4, 5] as const;

export function DimensionField({
  dimension,
  value,
  onChange,
}: {
  dimension: Dimension;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const labels = DIMENSION_LABELS[dimension];
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm text-ink-muted mb-1">{DIMENSION_TITLES[dimension]}</legend>
      <div className="flex flex-col gap-1">
        {LEVELS.map((level) => (
          <label key={level} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name={dimension} checked={value === level} onChange={() => onChange(level)} />
            {labels[level]}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="radio"
            name={dimension}
            checked={value === undefined}
            onChange={() => onChange(undefined)}
          />
          I'm unsure
        </label>
      </div>
    </fieldset>
  );
}
```

`frontend/src/components/discover/ProfileSummary.tsx`:
```typescript
export function ProfileSummary({ description }: { description: string[] }) {
  return (
    <div className="border border-surface-border rounded p-4">
      <h2 className="font-serif text-lg text-ink mb-2">Your Wine Profile</h2>
      {description.length === 0 ? (
        <p className="text-ink-muted text-sm">
          No specific preferences set — showing all wines, sorted alphabetically.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {description.map((line, i) => (
            <li
              key={i}
              className="text-sm bg-surface-raised border border-surface-border rounded-full px-3 py-1 text-ink"
            >
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement `DiscoverForm`**

`frontend/src/components/discover/DiscoverForm.tsx`:
```typescript
import { useState, type FormEvent } from "react";
import type { RecommendationAnswers } from "../../types/wine";
import { TYPE_OPTIONS, TYPE_LABELS, COUNTRY_OPTIONS } from "../../constants/wineOptions";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { DimensionField } from "./DimensionField";

export function DiscoverForm({
  initialAnswers,
  onSubmit,
}: {
  initialAnswers: RecommendationAnswers;
  onSubmit: (answers: RecommendationAnswers) => void;
}) {
  const [draft, setDraft] = useState<RecommendationAnswers>(initialAnswers);

  function update<K extends keyof RecommendationAnswers>(key: K, value: RecommendationAnswers[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xl">
      <div className="flex flex-col gap-1">
        <label htmlFor="discover-type" className="text-sm text-ink-muted">
          Wine type
        </label>
        <select
          id="discover-type"
          value={draft.type ?? ""}
          onChange={(e) => update("type", e.target.value || undefined)}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        >
          {TYPE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value === "" ? "No preference" : TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="discover-country" className="text-sm text-ink-muted">
          Country
        </label>
        <select
          id="discover-country"
          value={draft.country ?? ""}
          onChange={(e) => update("country", e.target.value || undefined)}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        >
          {COUNTRY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value === "" ? "No preference" : value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="discover-min-price" className="text-sm text-ink-muted">
            Min price
          </label>
          <input
            id="discover-min-price"
            type="number"
            min={0}
            value={draft.min_price ?? ""}
            onChange={(e) => update("min_price", e.target.value === "" ? undefined : Number(e.target.value))}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="discover-max-price" className="text-sm text-ink-muted">
            Max price
          </label>
          <input
            id="discover-max-price"
            type="number"
            min={0}
            value={draft.max_price ?? ""}
            onChange={(e) => update("max_price", e.target.value === "" ? undefined : Number(e.target.value))}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>
      </div>

      {DIMENSIONS.map((dimension) => (
        <DimensionField
          key={dimension}
          dimension={dimension}
          value={draft[dimension]}
          onChange={(value) => update(dimension, value)}
        />
      ))}

      <button type="submit" className="bg-accent text-surface font-semibold px-6 py-3 rounded self-start">
        See My Recommendations
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (70 tests — 58 from Tasks 1–2, plus 3 `discoverProfile`, 4 `DimensionField`, 2 `ProfileSummary`, 3 `DiscoverForm`)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/dimensionLabels.ts frontend/src/utils/discoverProfile.ts \
  frontend/src/utils/discoverProfile.test.ts frontend/src/components/discover
git commit -m "feat: add Discover questionnaire components"
```

---

### Task 4: `DiscoverPage`, routing, and verification

**Files:**
- Create: `frontend/src/pages/DiscoverPage.tsx`
- Modify: `frontend/src/pages/StubPages.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/DiscoverPage.test.tsx`

**Interfaces:**
- Consumes: `getRecommendations`, `ApiError` (Task 1); `WineGrid`, `LoadMoreButton`, `ErrorMessage` (existing); `DiscoverForm`, `ProfileSummary`, `getStoredProfile`/`setStoredProfile` (Task 3).
- Produces: `DiscoverPage` wired into `App.tsx` at `/discover`, replacing the stub.

- [ ] **Step 1: Write the failing tests**

`frontend/src/pages/DiscoverPage.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DiscoverPage } from "./DiscoverPage";
import * as api from "../services/api";
import type { RecommendationItem, RecommendationResponse } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getRecommendations: vi.fn() };
});

function makeItem(id: number, overrides: Partial<RecommendationItem> = {}): RecommendationItem {
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
    image_url: null,
    sweetness: null,
    acidity: null,
    tannin: null,
    body: null,
    fruitiness: null,
    match_score: 0.8,
    explanation: [],
    ...overrides,
  };
}

const getRecommendationsMock = api.getRecommendations as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(
    <MemoryRouter>
      <DiscoverPage />
    </MemoryRouter>
  );
}

describe("DiscoverPage", () => {
  beforeEach(() => {
    localStorage.clear();
    getRecommendationsMock.mockReset();
  });

  it("starts in form mode with no stored profile", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "See My Recommendations" })).toBeInTheDocument();
  });

  it("submitting the form fetches recommendations and switches to results mode", async () => {
    getRecommendationsMock.mockResolvedValue({
      profile: { description: ["Very dry"] },
      total: 1,
      items: [makeItem(1)],
    } satisfies RecommendationResponse);
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.getByText("Very dry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit preferences" })).toBeInTheDocument();
  });

  it("persists submitted answers to localStorage and loads results immediately on the next mount", async () => {
    getRecommendationsMock.mockResolvedValue({
      profile: { description: ["Dry"] },
      total: 1,
      items: [makeItem(2)],
    });
    const first = renderPage();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Wine type"), "red");
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    first.unmount();

    getRecommendationsMock.mockClear();
    getRecommendationsMock.mockResolvedValue({
      profile: { description: ["Dry"] },
      total: 1,
      items: [makeItem(2)],
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    expect(getRecommendationsMock).toHaveBeenCalledWith(expect.objectContaining({ type: "red" }));
  });

  it("clicking Edit preferences returns to the form pre-filled with the last answers", async () => {
    getRecommendationsMock.mockResolvedValue({
      profile: { description: [] },
      total: 1,
      items: [makeItem(1)],
    });
    renderPage();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Wine type"), "white");
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit preferences" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    expect(screen.getByLabelText("Wine type")).toHaveValue("white");
  });

  it("shows the empty-profile fallback message when profile.description is empty", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText(/no specific preferences set/i)).toBeInTheDocument());
  });

  it("shows an error message with retry when the request fails", async () => {
    getRecommendationsMock.mockRejectedValueOnce(new Error("network error"));
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText(/failed to load recommendations/i)).toBeInTheDocument());
  });

  it("clicking Load more appends the next page", async () => {
    getRecommendationsMock.mockResolvedValueOnce({
      profile: { description: [] },
      total: 2,
      items: [makeItem(1)],
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    getRecommendationsMock.mockResolvedValueOnce({
      profile: { description: [] },
      total: 2,
      items: [makeItem(2)],
    });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './DiscoverPage'`.

- [ ] **Step 3: Implement `DiscoverPage`**

`frontend/src/pages/DiscoverPage.tsx`:
```typescript
import { useEffect, useState } from "react";
import { ApiError, getRecommendations } from "../services/api";
import type { RecommendationAnswers, RecommendationItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { DiscoverForm } from "../components/discover/DiscoverForm";
import { ProfileSummary } from "../components/discover/ProfileSummary";
import { getStoredProfile, setStoredProfile } from "../utils/discoverProfile";

const PAGE_SIZE = 20;

export function DiscoverPage() {
  const [answers, setAnswers] = useState<RecommendationAnswers>(() => getStoredProfile() ?? {});
  const [mode, setMode] = useState<"form" | "results">(() => (getStoredProfile() ? "results" : "form"));
  const [profile, setProfile] = useState<string[]>([]);
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState<boolean>(() => getStoredProfile() !== null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredProfile();
    if (stored) {
      fetchRecommendations(stored, 0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRecommendations(currentAnswers: RecommendationAnswers, offset: number, append: boolean) {
    if (append) {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await getRecommendations({ ...currentAnswers, limit: PAGE_SIZE, offset });
      setProfile(response.profile.description);
      setTotal(response.total);
      setItems((prev) => (append ? [...prev, ...response.items] : response.items));
      setMode("results");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load recommendations";
      if (append) {
        setLoadMoreError(message);
      } else {
        setError(message);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  function handleSubmit(newAnswers: RecommendationAnswers) {
    setAnswers(newAnswers);
    setStoredProfile(newAnswers);
    fetchRecommendations(newAnswers, 0, false);
  }

  function handleLoadMore() {
    fetchRecommendations(answers, items.length, true);
  }

  const hasMore = items.length < total;

  if (mode === "form") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-2xl text-ink">Discover</h1>
        {error ? (
          <ErrorMessage message={error} onRetry={() => fetchRecommendations(answers, 0, false)} />
        ) : null}
        <DiscoverForm initialAnswers={answers} onSubmit={handleSubmit} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Discover</h1>
        <button type="button" onClick={() => setMode("form")} className="text-sm text-accent hover:underline">
          Edit preferences
        </button>
      </div>
      {loading ? (
        <WineGrid wines={[]} skeletonCount={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => fetchRecommendations(answers, 0, false)} />
      ) : (
        <>
          <ProfileSummary description={profile} />
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire `DiscoverPage` into routing**

In `frontend/src/pages/StubPages.tsx`, delete the `DiscoverPage` export (lines 1–10 — the `StubPage` import stays, since `PairPage`/`ComparePage`/`LearnPage` still use it). The file should start:
```typescript
import { StubPage } from "../components/common/StubPage";

export function PairPage() {
```
(everything from `PairPage` onward is unchanged).

In `frontend/src/App.tsx`, replace the import lines and the `/discover` route:
```typescript
import { Routes, Route } from "react-router-dom";
import { PageShell } from "./components/layout/PageShell";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { WineDetailPage } from "./pages/WineDetailPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { PairPage, ComparePage, LearnPage } from "./pages/StubPages";

export function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/wines/:id" element={<WineDetailPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/pair" element={<PairPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/learn" element={<LearnPage />} />
      </Routes>
    </PageShell>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (77 tests — 70 from Tasks 1–3 plus 7 new `DiscoverPage` tests), with `App.test.tsx` still green.

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
curl -s -H "Content-Type: application/json" -d '{"type":"red","tannin":5}' \
  -X POST "http://localhost:8000/api/recommendations" | head -c 500
curl -s -o /dev/null -w "frontend status: %{http_code}\n" http://localhost:5173
kill %1 %2
```
Confirm the `POST` returns real JSON with a `profile` and ranked `items` (not an error), and the frontend responds `200`. Then, with both servers running, open `http://localhost:5173/discover` in a browser and confirm by hand: the form renders all 5 dimension questions plus type/country/price, submitting shows the profile summary and ranked results with visible match-percentage badges on the cards, "Edit preferences" returns to the pre-filled form, and reloading the page after a submission goes straight to results (localStorage persistence). This visual check cannot be automated by `curl` — do it before considering this task done.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/DiscoverPage.tsx frontend/src/pages/DiscoverPage.test.tsx \
  frontend/src/pages/StubPages.tsx frontend/src/App.tsx
git commit -m "feat: add Discover page with questionnaire and ranked results"
```
