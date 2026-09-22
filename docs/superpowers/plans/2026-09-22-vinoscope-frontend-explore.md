# VinoScope Frontend (Explore & Wine Detail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the VinoScope frontend (`frontend/`) — a searchable/filterable wine catalog (Explore), a wine detail page, a Home landing page, and placeholder stub pages for the rest of the site's navigation — on top of the existing Wines API, plus the two small backend additions (name/winery search, CORS) it needs.

**Architecture:** React + TypeScript + Vite, styled with Tailwind CSS and a three-theme CSS-custom-property system, routed with `react-router-dom`. A thin `services/api.ts` wraps `fetch` against the FastAPI backend; a small `useApiQuery` hook handles loading/error/data state — no query library. Backend gains an additive `q` search param on `GET /api/wines` and CORS middleware.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS 3, react-router-dom 6, Vitest + React Testing Library (frontend tests). FastAPI/SQLAlchemy (existing backend, Task 1 only).

## Global Constraints

- No new runtime dependencies beyond React, TypeScript, Vite, Tailwind CSS, and react-router-dom — no TanStack Query, no UI component library.
- Backend changes are additive only: a new optional `q` query param on `GET /api/wines` and CORS middleware in `backend/app/main.py`. No changes to existing endpoint behavior, response shapes, or prior constraints from the wines-api design spec.
- Backend tests run against real Postgres (`vinoscope_test`) via FastAPI `TestClient` with the existing `get_db` dependency override — never mocks, matching the existing `tests/api/test_wines.py` pattern.
- Frontend tests use Vitest + React Testing Library; the API layer (`src/services/api.ts`) is mocked at the test boundary — the correct boundary for frontend tests (verifying rendering/interaction, not query correctness).
- All new frontend code lives under `frontend/`.
- Three swappable themes via `[data-theme]` on `<html>` — `dark-burgundy` (default), `cream-terracotta`, `charcoal-gold` — persisted to `localStorage` under key `vinoscope-theme`.
- Stub pages (`/discover`, `/pair`, `/compare`, `/learn`) render only a heading and one descriptive paragraph via the shared `StubPage` component — no real functionality.
- All built (non-stub) pages are mobile-responsive down to phone width.

---

### Task 1: Backend — name/winery search param and CORS

**Files:**
- Modify: `backend/app/services/wines.py`
- Modify: `backend/app/api/wines.py`
- Modify: `backend/app/main.py`
- Modify: `.env.example`
- Test (modify): `tests/api/test_wines.py`

**Interfaces:**
- Consumes: existing `_escape_like`, `list_wines` signature, `seeded_wines` fixture (all from the wines-api implementation).
- Produces: `list_wines(..., q: Optional[str] = None, ...)`; `GET /api/wines?q=...` matching wine name OR winery name; CORS headers on API responses for the origin(s) in `CORS_ORIGINS`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/api/test_wines.py`:
```python
def test_list_wines_filters_by_search_matches_wine_name(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "chardonnay"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine2"]


def test_list_wines_filters_by_search_matches_winery_name(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "caymus"})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {seeded_wines["wine1"], seeded_wines["wine2"]}


def test_list_wines_search_is_case_insensitive(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "MARGAUX"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_search_escapes_percent_wildcard(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "%"})
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_wines_search_combines_with_other_filters(client, seeded_wines):
    response = client.get("/api/wines", params={"q": "caymus", "type": "white"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine2"]


def test_cors_allows_configured_frontend_origin(client):
    response = client.get("/api/wines", headers={"Origin": "http://localhost:5173"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_wines.py -k "search or cors" -v`
Expected: FAIL — the `q`-based tests fail on assertion mismatches (the param is silently ignored by the current route, so unfiltered totals come back instead of the filtered ones), and the CORS test fails because no `access-control-allow-origin` header is present yet.

- [ ] **Step 3: Add the `q` filter to the service layer**

In `backend/app/services/wines.py`, change the import line to add `or_`:
```python
from sqlalchemy import func, or_, select
```

Add `q: Optional[str] = None,` to the `list_wines` signature, after `grape`:
```python
def list_wines(
    db: Session,
    *,
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    q: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: SortOption = "winery",
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[dict]]:
```

Add the filter, after the existing `grape` filter block:
```python
    if q is not None:
        pattern = f"%{_escape_like(q)}%"
        stmt = stmt.where(or_(Wine.name.ilike(pattern, escape="\\"), Winery.name.ilike(pattern, escape="\\")))
```

- [ ] **Step 4: Wire the `q` param through the route and add CORS middleware**

In `backend/app/api/wines.py`, add `q: Optional[str] = None,` to the `list_wines` route function signature (after `grape`) and pass it through:
```python
@router.get("/wines", response_model=WineListResponse)
def list_wines(
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    q: Optional[str] = None,
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    sort: SortOption = "winery",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> WineListResponse:
    total, items = wines_service.list_wines(
        db,
        type=type,
        country=country,
        grape=grape,
        q=q,
        min_price=min_price,
        max_price=max_price,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return WineListResponse(total=total, items=items)
```

In `backend/app/main.py`, add CORS middleware, reading allowed origins from an env var:
```python
from dotenv import load_dotenv

load_dotenv()

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.wines import router as wines_router

app = FastAPI(title="VinoScope API")

cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(wines_router, prefix="/api")
```

Add the new env var to `.env.example` (append):
```
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/api/test_wines.py -v`
Expected: PASS (35 tests — 29 existing plus 5 search tests plus 1 CORS test)

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS (66 tests total — 35 API plus 31 data layer, all green)

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/wines.py backend/app/api/wines.py backend/app/main.py \
  .env.example tests/api/test_wines.py
git commit -m "feat: add wine/winery search filter and CORS support to Wines API"
```

---

### Task 2: Frontend foundation — scaffold, theming, routing, Home, stub pages

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/index.html`, `frontend/.env.example`, `frontend/.gitignore`, `frontend/vitest.setup.ts`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- Create: `frontend/src/theme/themes.css`, `frontend/src/theme/useTheme.ts`
- Create: `frontend/src/components/layout/Header.tsx`, `frontend/src/components/layout/Footer.tsx`, `frontend/src/components/layout/PageShell.tsx`, `frontend/src/components/layout/ThemeSwitcher.tsx`
- Create: `frontend/src/components/common/StubPage.tsx`
- Create: `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/StubPages.tsx`
- Test: `frontend/src/App.test.tsx`, `frontend/src/components/layout/ThemeSwitcher.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the foundation).
- Produces: `App` component at `frontend/src/App.tsx` with routes for `/`, `/explore` (placeholder), `/wines/:id` (placeholder), `/discover`, `/pair`, `/compare`, `/learn`. `PageShell`, `StubPage` components reused by later tasks. Theme system (`getStoredTheme`/`setStoredTheme`/`THEME_OPTIONS`/`Theme` type from `frontend/src/theme/useTheme.ts`) that Task 5/6 pages render inside via `PageShell` (no direct dependency needed).

- [ ] **Step 1: Create the project config files and install dependencies**

`frontend/package.json`:
```json
{
  "name": "vinoscope-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.1.1",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.5.4",
    "vite": "^5.3.4",
    "vitest": "^2.0.5"
  }
}
```

`frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  },
});
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

`frontend/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
      },
      colors: {
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        "surface-border": "var(--color-surface-border)",
        ink: "var(--color-ink)",
        "ink-muted": "var(--color-ink-muted)",
        accent: "var(--color-accent)",
      },
    },
  },
  plugins: [],
};
```

`frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VinoScope</title>
    <script>
      (function () {
        try {
          var stored = localStorage.getItem("vinoscope-theme");
          var theme = stored === "cream-terracotta" || stored === "charcoal-gold" ? stored : "dark-burgundy";
          document.documentElement.setAttribute("data-theme", theme);
        } catch (e) {
          document.documentElement.setAttribute("data-theme", "dark-burgundy");
        }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/.env.example`:
```
VITE_API_BASE_URL=http://localhost:8000
```

`frontend/.gitignore`:
```
node_modules
dist
dist-ssr
*.local
```

`frontend/vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

Run: `cd frontend && npm install && cd ..`

- [ ] **Step 2: Write the failing tests**

`frontend/src/App.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("App routing", () => {
  it("renders the home page at /", () => {
    renderAt("/");
    expect(screen.getByText(/find a wine you'll actually enjoy/i)).toBeInTheDocument();
  });

  it("renders the Discover stub page at /discover", () => {
    renderAt("/discover");
    expect(screen.getByRole("heading", { name: "Discover" })).toBeInTheDocument();
  });

  it("renders the Pair stub page at /pair", () => {
    renderAt("/pair");
    expect(screen.getByRole("heading", { name: "Pair" })).toBeInTheDocument();
  });

  it("renders the Compare stub page at /compare", () => {
    renderAt("/compare");
    expect(screen.getByRole("heading", { name: "Compare" })).toBeInTheDocument();
  });

  it("renders the Learn stub page at /learn", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { name: "Learn" })).toBeInTheDocument();
  });

  it("renders nav links to all main pages", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "Pair" })).toHaveAttribute("href", "/pair");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "/learn");
  });
});
```

`frontend/src/components/layout/ThemeSwitcher.test.tsx`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "./ThemeSwitcher";

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark-burgundy", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("combobox")).toHaveValue("dark-burgundy");
  });

  it("switching themes updates the root data-theme attribute and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.selectOptions(screen.getByRole("combobox"), "charcoal-gold");
    expect(document.documentElement.getAttribute("data-theme")).toBe("charcoal-gold");
    expect(localStorage.getItem("vinoscope-theme")).toBe("charcoal-gold");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './App'` and `Cannot find module './ThemeSwitcher'` (neither file exists yet).

- [ ] **Step 4: Implement the theme system**

`frontend/src/theme/themes.css`:
```css
:root,
[data-theme="dark-burgundy"] {
  --color-surface: #231416;
  --color-surface-raised: #2f1b1e;
  --color-surface-border: #4a262b;
  --color-ink: #e8dcc8;
  --color-ink-muted: #a8908a;
  --color-accent: #c9a86a;
}

[data-theme="cream-terracotta"] {
  --color-surface: #f5efe6;
  --color-surface-raised: #ffffff;
  --color-surface-border: #e3d5c0;
  --color-ink: #3a2a22;
  --color-ink-muted: #8a7a6a;
  --color-accent: #a8452f;
}

[data-theme="charcoal-gold"] {
  --color-surface: #1c1c1e;
  --color-surface-raised: #242426;
  --color-surface-border: #38383a;
  --color-ink: #f0f0f0;
  --color-ink-muted: #8a8a8e;
  --color-accent: #d4af6a;
}
```

`frontend/src/theme/useTheme.ts`:
```typescript
export type Theme = "dark-burgundy" | "cream-terracotta" | "charcoal-gold";

const STORAGE_KEY = "vinoscope-theme";
const THEMES: Theme[] = ["dark-burgundy", "cream-terracotta", "charcoal-gold"];

export function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as string[]).includes(value);
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "dark-burgundy";
  } catch {
    return "dark-burgundy";
  }
}

export function setStoredTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (private browsing, etc.) — theme still applies for this session
  }
}

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark-burgundy", label: "Dark Burgundy" },
  { value: "cream-terracotta", label: "Cream & Terracotta" },
  { value: "charcoal-gold", label: "Charcoal & Gold" },
];
```

`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import "./theme/themes.css";

body {
  background-color: var(--color-surface);
  color: var(--color-ink);
}
```

- [ ] **Step 5: Implement the layout components**

`frontend/src/components/layout/ThemeSwitcher.tsx`:
```typescript
import { useState } from "react";
import { getStoredTheme, setStoredTheme, THEME_OPTIONS, type Theme } from "../../theme/useTheme";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  function handleChange(next: Theme) {
    setStoredTheme(next);
    setTheme(next);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Theme</span>
      <select
        value={theme}
        onChange={(e) => handleChange(e.target.value as Theme)}
        className="bg-surface-raised border border-surface-border text-ink rounded px-2 py-1"
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

`frontend/src/components/layout/Header.tsx`:
```typescript
import { NavLink } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/pair", label: "Pair" },
  { to: "/compare", label: "Compare" },
  { to: "/learn", label: "Learn" },
];

export function Header() {
  return (
    <header className="border-b border-surface-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <NavLink to="/" className="font-serif text-lg tracking-wide text-ink">
          VinoScope
        </NavLink>
        <nav className="flex items-center gap-4 text-sm flex-wrap">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "text-accent" : "text-ink-muted hover:text-ink")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
```

`frontend/src/components/layout/Footer.tsx`:
```typescript
export function Footer() {
  return (
    <footer className="border-t border-surface-border mt-12">
      <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-ink-muted">
        VinoScope is a discovery and comparison tool. It does not sell wine directly — retailer
        links take you to the original listing.
      </div>
    </footer>
  );
}
```

`frontend/src/components/layout/PageShell.tsx`:
```typescript
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 6: Implement the stub pages, Home page, and App routing**

`frontend/src/components/common/StubPage.tsx`:
```typescript
export function StubPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl text-ink mb-4">{title}</h1>
      <p className="text-ink-muted">{description}</p>
    </div>
  );
}
```

`frontend/src/pages/StubPages.tsx`:
```typescript
import { StubPage } from "../components/common/StubPage";

export function DiscoverPage() {
  return (
    <StubPage
      title="Discover"
      description="Discover will be a short questionnaire about what you like — sweetness, body, tannin, acidity, food pairings, and more. Answers you're unsure about are left out rather than guessed, and your answers become a preference profile that's matched against every wine in the catalog using a weighted similarity score. This page doesn't have a working questionnaire yet."
    />
  );
}

export function PairPage() {
  return (
    <StubPage
      title="Pair"
      description="Pair will help you find a wine for a specific dish — steak, seafood, pasta, dessert, and more — by turning the food into the same kind of preference vector Discover uses, then matching it against the catalog. This page doesn't have working pairing search yet."
    />
  );
}

export function ComparePage() {
  return (
    <StubPage
      title="Compare"
      description="Compare will let you put two to four wines side by side — price, region, grape, ABV, and characteristics like tannin and body — with a radar chart to make the differences easy to see at a glance. This page doesn't have working comparison yet."
    />
  );
}

export function LearnPage() {
  return (
    <StubPage
      title="Learn"
      description="Learn will cover the basics behind the terms used across the site: grape varieties, wine regions, and concepts like tannin, acidity, body, and terroir. This page doesn't have real content yet."
    />
  );
}
```

`frontend/src/pages/HomePage.tsx`:
```typescript
import { Link } from "react-router-dom";

const TEASERS = [
  { to: "/discover", title: "Discover", blurb: "Find your wine profile" },
  { to: "/pair", title: "Pair", blurb: "Match wine to food" },
  { to: "/compare", title: "Compare", blurb: "Wines side by side" },
  { to: "/learn", title: "Learn", blurb: "Grapes, regions, terms" },
];

export function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="py-12 text-center">
        <h1 className="font-serif text-4xl text-ink mb-4">Find a wine you'll actually enjoy.</h1>
        <p className="text-ink-muted mb-6 max-w-xl mx-auto">
          Browse a real catalog of wines by type, country, grape, and price — with full detail
          pages and outbound links to retailers.
        </p>
        <Link to="/explore" className="inline-block bg-accent text-surface font-semibold px-6 py-3 rounded">
          Explore Wines
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEASERS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="block border border-surface-border rounded p-4 hover:border-accent"
          >
            <h2 className="font-serif text-lg text-ink mb-1">{item.title}</h2>
            <p className="text-sm text-ink-muted">{item.blurb}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
```

`frontend/src/App.tsx`:
```typescript
import { Routes, Route } from "react-router-dom";
import { PageShell } from "./components/layout/PageShell";
import { StubPage } from "./components/common/StubPage";
import { HomePage } from "./pages/HomePage";
import { DiscoverPage, PairPage, ComparePage, LearnPage } from "./pages/StubPages";

export function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/explore"
          element={<StubPage title="Explore" description="The wine catalog is coming soon." />}
        />
        <Route
          path="/wines/:id"
          element={<StubPage title="Wine Detail" description="Wine detail pages are coming soon." />}
        />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/pair" element={<PairPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/learn" element={<LearnPage />} />
      </Routes>
    </PageShell>
  );
}
```

- [ ] **Step 7: Implement the entry point**

`frontend/src/main.tsx`:
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (8 tests — 6 in `App.test.tsx`, 2 in `ThemeSwitcher.test.tsx`)

- [ ] **Step 9: Verify the production build compiles**

Run: `cd frontend && npm run build`
Expected: Succeeds with no TypeScript errors, producing a `frontend/dist/` directory.

- [ ] **Step 10: Commit**

```bash
git add frontend
git commit -m "feat: scaffold VinoScope frontend with routing, theming, and stub pages"
```

---

### Task 3: API client, types, and data-fetching hook

**Files:**
- Create: `frontend/src/types/wine.ts`
- Create: `frontend/src/services/api.ts`
- Create: `frontend/src/hooks/useApiQuery.ts`
- Test: `frontend/src/services/api.test.ts`, `frontend/src/hooks/useApiQuery.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: types `Grape`, `WineListItem`, `WineListResponse`, `RetailerListing`, `WineDetail`, `SortOption`, `ListWinesParams` from `frontend/src/types/wine.ts`. `listWines(params?) -> Promise<WineListResponse>`, `getWine(id) -> Promise<WineDetail>`, `ApiError` (has `.status: number`) from `frontend/src/services/api.ts`. `useApiQuery<T>(fetcher, deps) -> { data: T | null, loading: boolean, error: Error | null }` from `frontend/src/hooks/useApiQuery.ts`. All reused by Tasks 4–6.

- [ ] **Step 1: Write the failing tests**

`frontend/src/services/api.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { listWines, getWine, ApiError } from "./api";

describe("api service", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("listWines builds a query string from provided params and returns parsed JSON", async () => {
    const mockResponse = { total: 1, items: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await listWines({ type: "red", q: "caymus", limit: 10 });

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/wines?");
    expect(calledUrl).toContain("type=red");
    expect(calledUrl).toContain("q=caymus");
    expect(calledUrl).toContain("limit=10");
    expect(result).toEqual(mockResponse);
  });

  it("listWines omits unset params from the query string", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total: 0, items: [] }),
    });

    await listWines({});

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl.endsWith("/api/wines")).toBe(true);
  });

  it("listWines throws ApiError on a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(listWines()).rejects.toBeInstanceOf(ApiError);
  });

  it("getWine returns parsed JSON on success", async () => {
    const mockWine = { id: 1, name: "Test Wine" };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockWine });

    const result = await getWine(1);
    expect(result).toEqual(mockWine);
    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/wines/1");
  });

  it("getWine throws a 404 ApiError when the wine is not found", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: "Wine not found" }) });

    await expect(getWine(999)).rejects.toMatchObject({ status: 404 });
  });
});
```

`frontend/src/hooks/useApiQuery.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiQuery } from "./useApiQuery";

describe("useApiQuery", () => {
  it("starts in a loading state and resolves to data", async () => {
    const fetcher = vi.fn().mockResolvedValue({ hello: "world" });
    const { result } = renderHook(() => useApiQuery(fetcher, []));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ hello: "world" });
    expect(result.current.error).toBeNull();
  });

  it("captures a rejected fetcher as an error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useApiQuery(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.data).toBeNull();
  });

  it("re-fetches when deps change", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const { result, rerender } = renderHook(({ dep }) => useApiQuery(fetcher, [dep]), {
      initialProps: { dep: 1 },
    });

    await waitFor(() => expect(result.current.data).toBe("first"));

    rerender({ dep: 2 });
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './api'` and `Cannot find module './useApiQuery'`.

- [ ] **Step 3: Implement the wine types**

`frontend/src/types/wine.ts`:
```typescript
export interface Grape {
  name: string;
  percentage: number | null;
}

export interface WineListItem {
  id: number;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  country: string | null;
  region: string | null;
  grapes: Grape[];
  price: number | null;
  image_url: string | null;
  sweetness: number | null;
  acidity: number | null;
  tannin: number | null;
  body: number | null;
  fruitiness: number | null;
}

export interface WineListResponse {
  total: number;
  items: WineListItem[];
}

export interface RetailerListing {
  retailer: string;
  price: number | null;
  currency: string | null;
  product_url: string | null;
  availability: string | null;
}

export interface WineDetail extends WineListItem {
  subregion: string | null;
  abv: number | null;
  description: string | null;
  listings: RetailerListing[];
}

export type SortOption = "price_asc" | "price_desc" | "vintage" | "winery";

export interface ListWinesParams {
  q?: string;
  type?: string;
  country?: string;
  grape?: string;
  min_price?: number;
  max_price?: number;
  sort?: SortOption;
  limit?: number;
  offset?: number;
}
```

- [ ] **Step 4: Implement the API client**

`frontend/src/services/api.ts`:
```typescript
import type { ListWinesParams, WineDetail, WineListResponse } from "../types/wine";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function buildQueryString(params: ListWinesParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function listWines(params: ListWinesParams = {}): Promise<WineListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/wines${buildQueryString(params)}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load wines (${response.status})`);
  }
  return response.json();
}

export async function getWine(id: number): Promise<WineDetail> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${id}`);
  if (response.status === 404) {
    throw new ApiError(404, "Wine not found");
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load wine (${response.status})`);
  }
  return response.json();
}
```

- [ ] **Step 5: Implement the data-fetching hook**

`frontend/src/hooks/useApiQuery.ts`:
```typescript
import { useEffect, useState } from "react";

interface ApiQueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useApiQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiQueryState<T> {
  const [state, setState] = useState<ApiQueryState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (16 tests — 8 from Task 2, 5 in `api.test.ts`, 3 in `useApiQuery.test.ts`)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types frontend/src/services frontend/src/hooks
git commit -m "feat: add frontend API client, types, and data-fetching hook"
```

---

### Task 4: Wine display components

**Files:**
- Create: `frontend/src/utils/format.ts`
- Create: `frontend/src/components/wine/WineCard.tsx`, `frontend/src/components/wine/WineGrid.tsx`, `frontend/src/components/wine/CharacteristicBar.tsx`, `frontend/src/components/wine/RetailerListingRow.tsx`
- Create: `frontend/src/components/common/Skeleton.tsx`, `frontend/src/components/common/ErrorMessage.tsx`
- Test: `frontend/src/components/wine/WineCard.test.tsx`, `frontend/src/components/wine/WineGrid.test.tsx`, `frontend/src/components/wine/CharacteristicBar.test.tsx`, `frontend/src/components/wine/RetailerListingRow.test.tsx`, `frontend/src/components/common/ErrorMessage.test.tsx`

**Interfaces:**
- Consumes: `WineListItem`, `RetailerListing` types and `Grape` type (Task 3).
- Produces: `WineCard`, `WineGrid`, `CharacteristicBar`, `RetailerListingRow` (all `components/wine/`), `Skeleton`/`WineCardSkeleton` (`components/common/Skeleton.tsx`), `ErrorMessage` (`components/common/ErrorMessage.tsx`) — all reused by Tasks 5 and 6.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/wine/WineCard.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WineCard } from "./WineCard";
import type { WineListItem } from "../../types/wine";

const baseWine: WineListItem = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: "United States",
  region: "Napa Valley",
  grapes: [{ name: "Cabernet Sauvignon", percentage: 100 }],
  price: 79.99,
  image_url: "https://example.com/bottle.jpg",
  sweetness: 1,
  acidity: 3,
  tannin: 5,
  body: 5,
  fruitiness: 3,
};

function renderCard(wine: WineListItem) {
  render(
    <MemoryRouter>
      <WineCard wine={wine} />
    </MemoryRouter>
  );
}

describe("WineCard", () => {
  it("renders the wine's name, winery, vintage, and price", () => {
    renderCard(baseWine);
    expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument();
    expect(screen.getByText(/Caymus Vineyards/)).toBeInTheDocument();
    expect(screen.getByText(/2022/)).toBeInTheDocument();
    expect(screen.getByText("$79.99")).toBeInTheDocument();
  });

  it("links to the wine's detail page", () => {
    renderCard(baseWine);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/wines/1");
  });

  it("shows 'Price unavailable' when price is null", () => {
    renderCard({ ...baseWine, price: null });
    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
  });

  it("falls back to a placeholder image when image_url is null", () => {
    renderCard({ ...baseWine, image_url: null });
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("data:image/svg+xml");
  });

  it("shows 'Blend' for wines with more than one grape", () => {
    renderCard({
      ...baseWine,
      grapes: [
        { name: "Cabernet Sauvignon", percentage: 60 },
        { name: "Merlot", percentage: 40 },
      ],
    });
    expect(screen.getByText("Blend")).toBeInTheDocument();
  });
});
```

`frontend/src/components/wine/WineGrid.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WineGrid } from "./WineGrid";
import type { WineListItem } from "../../types/wine";

function wine(id: number): WineListItem {
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
  };
}

describe("WineGrid", () => {
  it("renders one card per wine", () => {
    render(
      <MemoryRouter>
        <WineGrid wines={[wine(1), wine(2)]} />
      </MemoryRouter>
    );
    expect(screen.getByText("Wine 1")).toBeInTheDocument();
    expect(screen.getByText("Wine 2")).toBeInTheDocument();
  });

  it("renders skeleton placeholders when skeletonCount is set", () => {
    render(
      <MemoryRouter>
        <WineGrid wines={[]} skeletonCount={3} />
      </MemoryRouter>
    );
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });
});
```

`frontend/src/components/wine/CharacteristicBar.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacteristicBar } from "./CharacteristicBar";

describe("CharacteristicBar", () => {
  it("renders the label and value out of 5", () => {
    render(<CharacteristicBar label="Tannin" value={4} />);
    expect(screen.getByText("Tannin")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("renders 'Not rated' when value is null", () => {
    render(<CharacteristicBar label="Acidity" value={null} />);
    expect(screen.getByText("Not rated")).toBeInTheDocument();
  });
});
```

`frontend/src/components/wine/RetailerListingRow.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RetailerListingRow } from "./RetailerListingRow";

describe("RetailerListingRow", () => {
  it("renders the retailer name, price, and an outbound link", () => {
    render(
      <RetailerListingRow
        listing={{
          retailer: "Total Wine",
          price: 79.99,
          currency: "USD",
          product_url: "https://totalwine.com/product",
          availability: "In Stock",
        }}
      />
    );
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
    expect(screen.getByText("$79.99")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View Retailer" });
    expect(link).toHaveAttribute("href", "https://totalwine.com/product");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the link when product_url is null", () => {
    render(
      <RetailerListingRow
        listing={{ retailer: "Local Shop", price: 50, currency: "USD", product_url: null, availability: null }}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
```

`frontend/src/components/common/ErrorMessage.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorMessage } from "./ErrorMessage";

describe("ErrorMessage", () => {
  it("renders the message", () => {
    render(<ErrorMessage message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorMessage message="Failed" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when onRetry is not provided", () => {
    render(<ErrorMessage message="Failed" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './WineCard'`, `'./WineGrid'`, `'./CharacteristicBar'`, `'./RetailerListingRow'`, `'./ErrorMessage'`.

- [ ] **Step 3: Implement formatting utilities**

`frontend/src/utils/format.ts`:
```typescript
export function formatPrice(price: number | null): string {
  if (price === null) return "Price unavailable";
  return `$${price.toFixed(2)}`;
}

export function formatVintage(vintage: number | null): string {
  return vintage === null ? "NV" : String(vintage);
}

export function primaryGrapeLabel(grapes: { name: string; percentage: number | null }[]): string {
  if (grapes.length === 0) return "Blend unknown";
  if (grapes.length === 1) return grapes[0].name;
  return "Blend";
}
```

- [ ] **Step 4: Implement Skeleton and ErrorMessage**

`frontend/src/components/common/Skeleton.tsx`:
```typescript
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-raised rounded ${className}`} data-testid="skeleton" />;
}

export function WineCardSkeleton() {
  return (
    <div className="border border-surface-border rounded overflow-hidden">
      <Skeleton className="w-full h-48" />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
```

`frontend/src/components/common/ErrorMessage.tsx`:
```typescript
export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-surface-border rounded p-4 text-center">
      <p className="text-ink-muted mb-2">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="text-sm text-accent hover:underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Implement WineCard and WineGrid**

`frontend/src/components/wine/WineCard.tsx`:
```typescript
import { Link } from "react-router-dom";
import type { WineListItem } from "../../types/wine";
import { formatPrice, formatVintage, primaryGrapeLabel } from "../../utils/format";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='260'%3E%3Crect width='200' height='260' fill='%232f1b1e'/%3E%3C/svg%3E";

export function WineCard({ wine }: { wine: WineListItem }) {
  return (
    <Link
      to={`/wines/${wine.id}`}
      className="block border border-surface-border rounded overflow-hidden hover:border-accent"
    >
      <img
        src={wine.image_url ?? PLACEHOLDER_IMAGE}
        alt={wine.name}
        className="w-full h-48 object-cover bg-surface-raised"
      />
      <div className="p-3">
        <span className="inline-block text-xs uppercase tracking-wide text-accent mb-1">{wine.type}</span>
        <h3 className="font-serif text-base text-ink">{wine.name}</h3>
        <p className="text-sm text-ink-muted">
          {wine.winery} &middot; {formatVintage(wine.vintage)}
        </p>
        <p className="text-sm text-ink-muted">{[wine.region, wine.country].filter(Boolean).join(", ")}</p>
        <p className="text-sm text-ink-muted">{primaryGrapeLabel(wine.grapes)}</p>
        <p className="text-sm font-semibold text-ink mt-1">{formatPrice(wine.price)}</p>
      </div>
    </Link>
  );
}
```

`frontend/src/components/wine/WineGrid.tsx`:
```typescript
import type { WineListItem } from "../../types/wine";
import { WineCard } from "./WineCard";
import { WineCardSkeleton } from "../common/Skeleton";

export function WineGrid({ wines, skeletonCount = 0 }: { wines: WineListItem[]; skeletonCount?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {wines.map((wine) => (
        <WineCard key={wine.id} wine={wine} />
      ))}
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <WineCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Implement CharacteristicBar and RetailerListingRow**

`frontend/src/components/wine/CharacteristicBar.tsx`:
```typescript
const CHARACTERISTIC_MAX = 5;

export function CharacteristicBar({ label, value }: { label: string; value: number | null }) {
  const percent = value === null ? 0 : (value / CHARACTERISTIC_MAX) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-muted w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-ink-muted w-16 text-right">
        {value === null ? "Not rated" : `${value}/5`}
      </span>
    </div>
  );
}
```

`frontend/src/components/wine/RetailerListingRow.tsx`:
```typescript
import type { RetailerListing } from "../../types/wine";
import { formatPrice } from "../../utils/format";

export function RetailerListingRow({ listing }: { listing: RetailerListing }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2 last:border-b-0">
      <div>
        <p className="text-sm text-ink">{listing.retailer}</p>
        <p className="text-xs text-ink-muted">{formatPrice(listing.price)}</p>
      </div>
      {listing.product_url ? (
        <a
          href={listing.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent hover:underline"
        >
          View Retailer
        </a>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (30 tests — 16 from Tasks 2–3, plus 5 WineCard, 2 WineGrid, 2 CharacteristicBar, 2 RetailerListingRow, 3 ErrorMessage)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/utils frontend/src/components/wine frontend/src/components/common
git commit -m "feat: add wine display components (card, grid, characteristics, retailer listing)"
```

---

### Task 5: Explore page — search, filter, sort, pagination

**Files:**
- Create: `frontend/src/components/explore/filterTypes.ts`, `frontend/src/components/explore/FilterButton.tsx`, `frontend/src/components/explore/FilterDrawer.tsx`, `frontend/src/components/explore/LoadMoreButton.tsx`, `frontend/src/components/explore/EmptyState.tsx`
- Create: `frontend/src/pages/ExplorePage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/explore/filterTypes.test.ts`, `frontend/src/components/explore/FilterDrawer.test.tsx`, `frontend/src/pages/ExplorePage.test.tsx`

**Interfaces:**
- Consumes: `listWines`, `ApiError` (Task 3), `useApiQuery` (Task 3), `WineListItem`/`SortOption`/`ListWinesParams` (Task 3), `WineGrid` (Task 4), `ErrorMessage` (Task 4).
- Produces: `ExplorePage` wired into `App.tsx` at `/explore`, replacing the Task 2 placeholder.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/explore/filterTypes.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { DEFAULT_FILTERS, countActiveFilters, filtersToApiParams } from "./filterTypes";

describe("countActiveFilters", () => {
  it("returns 0 for default filters", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it("counts each non-empty filter field", () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, type: "red", country: "France", minPrice: "10" })).toBe(3);
  });
});

describe("filtersToApiParams", () => {
  it("omits empty fields and includes limit/offset/sort", () => {
    const params = filtersToApiParams(DEFAULT_FILTERS, 12, 0);
    expect(params).toEqual({ limit: 12, offset: 0, sort: "winery" });
  });

  it("includes provided fields and parses price strings to numbers", () => {
    const params = filtersToApiParams(
      { ...DEFAULT_FILTERS, q: "caymus", type: "red", minPrice: "10", maxPrice: "50" },
      12,
      24
    );
    expect(params).toEqual({
      limit: 12,
      offset: 24,
      sort: "winery",
      q: "caymus",
      type: "red",
      min_price: 10,
      max_price: 50,
    });
  });
});
```

`frontend/src/components/explore/FilterDrawer.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterDrawer } from "./FilterDrawer";
import { DEFAULT_FILTERS } from "./filterTypes";

describe("FilterDrawer", () => {
  it("renders nothing when closed", () => {
    render(<FilterDrawer open={false} initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onApply with the edited filter values", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(dialog).getByLabelText("Type"), "white");
    await user.type(within(dialog).getByLabelText("Search"), "caymus");
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ type: "white", q: "caymus" }));
  });

  it("resets the draft to the clear defaults when Clear is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, type: "red" }} onApply={vi.fn()} onClose={vi.fn()} />
    );

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(within(dialog).getByLabelText("Type")).toHaveValue("red");

    await user.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).getByLabelText("Type")).toHaveValue("");
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

`frontend/src/pages/ExplorePage.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ExplorePage } from "./ExplorePage";
import * as api from "../services/api";
import type { WineListItem } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

function makeWine(id: number, overrides: Partial<WineListItem> = {}): WineListItem {
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
    ...overrides,
  };
}

function renderExplore() {
  render(
    <MemoryRouter>
      <ExplorePage />
    </MemoryRouter>
  );
}

const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;

describe("ExplorePage", () => {
  beforeEach(() => {
    listWinesMock.mockReset();
  });

  it("loads and displays wines on mount", async () => {
    listWinesMock.mockResolvedValue({ total: 2, items: [makeWine(1), makeWine(2)] });
    renderExplore();

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.getByText("Wine 2")).toBeInTheDocument();
    expect(listWinesMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 12, offset: 0 }));
  });

  it("shows an empty state message when there are no wines", async () => {
    listWinesMock.mockResolvedValue({ total: 0, items: [] });
    renderExplore();

    await waitFor(() => expect(screen.getByText(/no wines match your filters/i)).toBeInTheDocument());
  });

  it("shows an error message with retry when the request fails", async () => {
    listWinesMock.mockRejectedValueOnce(new Error("network error"));
    renderExplore();

    await waitFor(() => expect(screen.getByText(/couldn't load wines/i)).toBeInTheDocument());

    listWinesMock.mockResolvedValueOnce({ total: 1, items: [makeWine(1)] });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
  });

  it("applying a filter re-fetches with the new params and resets pagination", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filters/i }));

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(dialog).getByLabelText("Type"), "white");
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(listWinesMock).toHaveBeenLastCalledWith(expect.objectContaining({ type: "white", offset: 0, limit: 12 }))
    );
  });

  it("clicking Load more appends the next page and hides once exhausted", async () => {
    listWinesMock.mockResolvedValueOnce({ total: 2, items: [makeWine(1)] });
    renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    listWinesMock.mockResolvedValueOnce({ total: 2, items: [makeWine(2)] });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './filterTypes'`, `'./FilterDrawer'`, `'./ExplorePage'`.

- [ ] **Step 3: Implement filter types and utilities**

`frontend/src/components/explore/filterTypes.ts`:
```typescript
import type { ListWinesParams, SortOption } from "../../types/wine";

export interface FilterValues {
  q: string;
  type: string;
  country: string;
  grape: string;
  minPrice: string;
  maxPrice: string;
  sort: SortOption;
}

export const DEFAULT_FILTERS: FilterValues = {
  q: "",
  type: "",
  country: "",
  grape: "",
  minPrice: "",
  maxPrice: "",
  sort: "winery",
};

export function countActiveFilters(filters: FilterValues): number {
  let count = 0;
  if (filters.q) count++;
  if (filters.type) count++;
  if (filters.country) count++;
  if (filters.grape) count++;
  if (filters.minPrice) count++;
  if (filters.maxPrice) count++;
  return count;
}

export function filtersToApiParams(filters: FilterValues, limit: number, offset: number): ListWinesParams {
  const params: ListWinesParams = { limit, offset, sort: filters.sort };
  if (filters.q) params.q = filters.q;
  if (filters.type) params.type = filters.type;
  if (filters.country) params.country = filters.country;
  if (filters.grape) params.grape = filters.grape;
  if (filters.minPrice !== "") params.min_price = Number(filters.minPrice);
  if (filters.maxPrice !== "") params.max_price = Number(filters.maxPrice);
  return params;
}
```

- [ ] **Step 4: Implement FilterButton, LoadMoreButton, EmptyState**

`frontend/src/components/explore/FilterButton.tsx`:
```typescript
export function FilterButton({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="border border-surface-border rounded px-4 py-2 text-sm text-ink">
      Filters{activeCount > 0 ? ` (${activeCount})` : ""}
    </button>
  );
}
```

`frontend/src/components/explore/LoadMoreButton.tsx`:
```typescript
export function LoadMoreButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mx-auto block border border-surface-border rounded px-6 py-2 text-sm text-ink disabled:opacity-50"
    >
      {loading ? "Loading..." : "Load more"}
    </button>
  );
}
```

`frontend/src/components/explore/EmptyState.tsx`:
```typescript
export function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-ink-muted mb-2">No wines match your filters.</p>
      <button type="button" onClick={onClear} className="text-sm text-accent hover:underline">
        Clear filters
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Implement FilterDrawer**

`frontend/src/components/explore/FilterDrawer.tsx`:
```typescript
import { useEffect, useState } from "react";
import type { SortOption } from "../../types/wine";
import { DEFAULT_FILTERS, type FilterValues } from "./filterTypes";

const TYPE_OPTIONS = ["", "red", "white", "rose", "sparkling"];
const TYPE_LABELS: Record<string, string> = {
  "": "All types",
  red: "Red",
  white: "White",
  rose: "Rosé",
  sparkling: "Sparkling",
};

const COUNTRY_OPTIONS = ["", "United States", "France", "Italy", "Spain", "Argentina", "Australia", "Other"];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "winery", label: "Winery (A-Z)" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "vintage", label: "Vintage" },
];

export function FilterDrawer({
  open,
  initialFilters,
  onApply,
  onClose,
}: {
  open: boolean;
  initialFilters: FilterValues;
  onApply: (filters: FilterValues) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterValues>(initialFilters);

  useEffect(() => {
    if (open) {
      setDraft(initialFilters);
    }
  }, [open, initialFilters]);

  if (!open) return null;

  function update<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-label="Filters">
      <div className="w-full max-w-sm bg-surface border-l border-surface-border p-4 overflow-y-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters" className="text-ink-muted">
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <label htmlFor="filter-search">Search</label>
          <input
            id="filter-search"
            type="text"
            value={draft.q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="Wine or winery name"
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <label htmlFor="filter-type">Type</label>
          <select
            id="filter-type"
            value={draft.type}
            onChange={(e) => update("type", e.target.value)}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          >
            {TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <label htmlFor="filter-country">Country</label>
          <select
            id="filter-country"
            value={draft.country}
            onChange={(e) => update("country", e.target.value)}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          >
            {COUNTRY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "" ? "All countries" : value}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <label htmlFor="filter-grape">Grape</label>
          <input
            id="filter-grape"
            type="text"
            value={draft.grape}
            onChange={(e) => update("grape", e.target.value)}
            placeholder="e.g. cabernet"
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex flex-col gap-1 text-sm text-ink-muted flex-1">
            <label htmlFor="filter-min-price">Min price</label>
            <input
              id="filter-min-price"
              type="number"
              min={0}
              value={draft.minPrice}
              onChange={(e) => update("minPrice", e.target.value)}
              className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
            />
          </div>
          <div className="flex flex-col gap-1 text-sm text-ink-muted flex-1">
            <label htmlFor="filter-max-price">Max price</label>
            <input
              id="filter-max-price"
              type="number"
              min={0}
              value={draft.maxPrice}
              onChange={(e) => update("maxPrice", e.target.value)}
              className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <label htmlFor="filter-sort">Sort by</label>
          <select
            id="filter-sort"
            value={draft.sort}
            onChange={(e) => update("sort", e.target.value as SortOption)}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_FILTERS)}
            className="flex-1 border border-surface-border rounded py-2 text-sm text-ink-muted"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex-1 bg-accent text-surface rounded py-2 text-sm font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement ExplorePage**

`frontend/src/pages/ExplorePage.tsx`:
```typescript
import { useEffect, useState } from "react";
import { ApiError, listWines } from "../services/api";
import { useApiQuery } from "../hooks/useApiQuery";
import type { WineListItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { FilterButton } from "../components/explore/FilterButton";
import { FilterDrawer } from "../components/explore/FilterDrawer";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { EmptyState } from "../components/explore/EmptyState";
import { ErrorMessage } from "../components/common/ErrorMessage";
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  filtersToApiParams,
  type FilterValues,
} from "../components/explore/filterTypes";

const PAGE_SIZE = 12;

export function ExplorePage() {
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<WineListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const { data, loading, error } = useApiQuery(
    () => listWines(filtersToApiParams(appliedFilters, PAGE_SIZE, 0)),
    [appliedFilters]
  );

  useEffect(() => {
    if (data) {
      setItems(data.items);
      setTotal(data.total);
    }
  }, [data]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const next = await listWines(filtersToApiParams(appliedFilters, PAGE_SIZE, items.length));
      setItems((prev) => [...prev, ...next.items]);
    } catch (err) {
      setLoadMoreError(err instanceof ApiError ? err.message : "Failed to load more wines");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleApplyFilters(filters: FilterValues) {
    setAppliedFilters(filters);
    setDrawerOpen(false);
  }

  function handleClearFilters() {
    setAppliedFilters(DEFAULT_FILTERS);
  }

  const activeCount = countActiveFilters(appliedFilters);
  const hasMore = items.length < total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Explore</h1>
        <FilterButton activeCount={activeCount} onClick={() => setDrawerOpen(true)} />
      </div>

      {loading ? (
        <WineGrid wines={[]} skeletonCount={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage
          message="Couldn't load wines. Please try again."
          onRetry={() => setAppliedFilters({ ...appliedFilters })}
        />
      ) : items.length === 0 ? (
        <EmptyState onClear={handleClearFilters} />
      ) : (
        <>
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </>
      )}

      <FilterDrawer
        open={drawerOpen}
        initialFilters={appliedFilters}
        onApply={handleApplyFilters}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 7: Wire ExplorePage into the router**

In `frontend/src/App.tsx`, add the import:
```typescript
import { ExplorePage } from "./pages/ExplorePage";
```

Replace the `/explore` route's placeholder element:
```typescript
        <Route path="/explore" element={<ExplorePage />} />
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd frontend && npm run test`
Expected: PASS (43 tests — 30 from Tasks 2–4, plus 4 `filterTypes.test.ts`, 4 `FilterDrawer.test.tsx`, 5 `ExplorePage.test.tsx`, with `App.test.tsx` still green)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/explore frontend/src/pages/ExplorePage.tsx frontend/src/App.tsx
git commit -m "feat: add Explore page with search/filter/sort/pagination"
```

---

### Task 6: Wine Detail page and full-stack verification

**Files:**
- Create: `frontend/src/pages/WineDetailPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `README.md`
- Test: `frontend/src/pages/WineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getWine`, `ApiError` (Task 3), `useApiQuery` (Task 3), `WineDetail` type (Task 3), `CharacteristicBar`, `RetailerListingRow`, `ErrorMessage`, `Skeleton` (Task 4), `formatVintage` (Task 4).
- Produces: `WineDetailPage` wired into `App.tsx` at `/wines/:id`, replacing the Task 2 placeholder.

- [ ] **Step 1: Write the failing tests**

`frontend/src/pages/WineDetailPage.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WineDetailPage } from "./WineDetailPage";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import type { WineDetail } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getWine: vi.fn() };
});

const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;

const fullWine: WineDetail = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: "United States",
  region: "Napa Valley",
  subregion: null,
  abv: 14.6,
  description: "A bold, structured cabernet.",
  grapes: [{ name: "Cabernet Sauvignon", percentage: 100 }],
  price: 79.99,
  image_url: null,
  sweetness: 1,
  acidity: 3,
  tannin: 5,
  body: 5,
  fruitiness: 3,
  listings: [
    {
      retailer: "Total Wine",
      price: 79.99,
      currency: "USD",
      product_url: "https://totalwine.com/x",
      availability: "In Stock",
    },
  ],
};

function renderDetail(id = "1") {
  render(
    <MemoryRouter initialEntries={[`/wines/${id}`]}>
      <Routes>
        <Route path="/wines/:id" element={<WineDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WineDetailPage", () => {
  beforeEach(() => {
    getWineMock.mockReset();
  });

  it("renders the full wine record", async () => {
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    expect(screen.getByText(/Caymus Vineyards/)).toBeInTheDocument();
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
    expect(screen.getByText(/A bold, structured cabernet/)).toBeInTheDocument();
  });

  it("renders a not-found state on a 404", async () => {
    getWineMock.mockRejectedValue(new ApiError(404, "Wine not found"));
    renderDetail("999999");

    await waitFor(() => expect(screen.getByText("Wine not found")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /back to explore/i })).toHaveAttribute("href", "/explore");
  });

  it("renders 'No retailers currently listed' when there are no listings", async () => {
    getWineMock.mockResolvedValue({ ...fullWine, listings: [], price: null });
    renderDetail();

    await waitFor(() => expect(screen.getByText(/no retailers currently listed/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test`
Expected: FAIL — `Cannot find module './WineDetailPage'`.

- [ ] **Step 3: Implement WineDetailPage**

`frontend/src/pages/WineDetailPage.tsx`:
```typescript
import { useParams, Link } from "react-router-dom";
import { getWine, ApiError } from "../services/api";
import { useApiQuery } from "../hooks/useApiQuery";
import { CharacteristicBar } from "../components/wine/CharacteristicBar";
import { RetailerListingRow } from "../components/wine/RetailerListingRow";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { Skeleton } from "../components/common/Skeleton";
import { formatVintage } from "../utils/format";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='520'%3E%3Crect width='400' height='520' fill='%232f1b1e'/%3E%3C/svg%3E";

export function WineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wineId = Number(id);

  const { data: wine, loading, error } = useApiQuery(() => getWine(wineId), [wineId]);

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-8">
        <Skeleton className="w-full md:w-80 h-96" />
        <div className="flex-1 flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="text-center py-12">
        <h1 className="font-serif text-2xl text-ink mb-2">Wine not found</h1>
        <Link to="/explore" className="text-accent hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  if (error || !wine) {
    return <ErrorMessage message="Couldn't load this wine. Please try again." />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <img
        src={wine.image_url ?? PLACEHOLDER_IMAGE}
        alt={wine.name}
        className="w-full md:w-80 h-96 object-cover bg-surface-raised rounded"
      />

      <div className="flex-1 flex flex-col gap-4">
        <div>
          <span className="inline-block text-xs uppercase tracking-wide text-accent mb-1">{wine.type}</span>
          <h1 className="font-serif text-2xl text-ink">{wine.name}</h1>
          <p className="text-ink-muted">
            {wine.winery} &middot; {formatVintage(wine.vintage)}
          </p>
          <p className="text-ink-muted">{[wine.region, wine.subregion, wine.country].filter(Boolean).join(", ")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <CharacteristicBar label="Sweetness" value={wine.sweetness} />
          <CharacteristicBar label="Acidity" value={wine.acidity} />
          <CharacteristicBar label="Tannin" value={wine.tannin} />
          <CharacteristicBar label="Body" value={wine.body} />
          <CharacteristicBar label="Fruitiness" value={wine.fruitiness} />
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">Grapes</h2>
          <p className="text-ink">
            {wine.grapes.length === 0
              ? "Not specified"
              : wine.grapes
                  .map((g) => (g.percentage === null ? g.name : `${g.name} (${g.percentage}%)`))
                  .join(", ")}
          </p>
        </div>

        {wine.abv !== null ? <p className="text-ink-muted text-sm">ABV: {wine.abv}%</p> : null}

        {wine.description ? <p className="text-ink">{wine.description}</p> : null}

        <div>
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">Retailers</h2>
          {wine.listings.length === 0 ? (
            <p className="text-ink-muted text-sm">No retailers currently listed.</p>
          ) : (
            wine.listings.map((listing, i) => <RetailerListingRow key={i} listing={listing} />)
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire WineDetailPage into the router**

In `frontend/src/App.tsx`, add the import:
```typescript
import { WineDetailPage } from "./pages/WineDetailPage";
```

Replace the `/wines/:id` route's placeholder element:
```typescript
        <Route path="/wines/:id" element={<WineDetailPage />} />
```

The `StubPage` import in `App.tsx` is now unused — remove it:
```typescript
import { Routes, Route } from "react-router-dom";
import { PageShell } from "./components/layout/PageShell";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { WineDetailPage } from "./pages/WineDetailPage";
import { DiscoverPage, PairPage, ComparePage, LearnPage } from "./pages/StubPages";

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
Expected: PASS (46 tests — 43 from Tasks 2–5 plus 3 `WineDetailPage.test.tsx`, with `App.test.tsx` still green)

- [ ] **Step 6: Verify the production build compiles**

Run: `cd frontend && npm run build`
Expected: Succeeds with no TypeScript errors (confirms the removed `StubPage` import doesn't trip `noUnusedLocals`, and the new page compiles cleanly).

- [ ] **Step 7: Manually verify the full stack boots and serves real data**

This mirrors the lesson from the data layer and Wines API phases: tests passing is not the same as the app actually running end to end. Run, from the repo root:
```bash
cd backend
uvicorn app.main:app --port 8000 &
cd ..
cd frontend
cp .env.example .env
npm run dev -- --port 5173 &
cd ..
sleep 3
curl -s -H "Origin: http://localhost:5173" -i "http://localhost:8000/api/wines?limit=1"
curl -s -o /dev/null -w "frontend status: %{http_code}\n" http://localhost:5173
kill %1 %2
```
Confirm:
- The first `curl` response includes `access-control-allow-origin: http://localhost:5173` and a JSON body with real wine data from the `vinoscope` dev database (not a stack trace or connection error).
- The second `curl` prints `frontend status: 200`.

Then open `http://localhost:5173` in a browser (with the backend still running) and confirm by hand: the Explore page loads real wines, the filter drawer opens and applying a filter changes the results, clicking a wine card opens its detail page with characteristics and retailer links, and the theme switcher changes the palette. This visual check cannot be automated by `curl` — do it before considering this task done.

- [ ] **Step 8: Update the README with frontend setup instructions**

Append to `README.md`:
```markdown

## Frontend setup

1. Copy the environment file:
   `cp frontend/.env.example frontend/.env`
2. Install dependencies:
   `cd frontend && npm install && cd ..`
3. Start the backend API (the frontend needs it for data):
   `cd backend && uvicorn app.main:app --port 8000`
4. In a separate terminal, start the frontend dev server:
   `cd frontend && npm run dev`
5. Open the printed local URL (default `http://localhost:5173`).
6. Run frontend tests: `cd frontend && npm run test`
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/WineDetailPage.tsx frontend/src/App.tsx README.md
git commit -m "feat: add Wine Detail page and verify full-stack integration"
```
