# VinoScope Discover Page Design

## Overview

The Discover page: a preference questionnaire that calls the existing `POST /api/recommendations` endpoint and displays ranked results. Replaces the current `/discover` stub. This is the frontend counterpart to the recommendation engine — no backend changes needed here beyond what's already built.

## Goals

- A single-page questionnaire covering wine type, country, price range, and the five soft-preference dimensions (sweetness, acidity, tannin, body, fruit intensity), each with an explicit "I'm unsure" option
- Submitting shows a "Your Wine Profile" summary plus ranked wine results, each showing a match % and a short "why this matched" line
- Answers persist to `localStorage`; a returning visitor sees their recommendations immediately on load, not just a pre-filled form
- Reuse existing components (`WineCard`, `WineGrid`, `LoadMoreButton`, `ErrorMessage`, skeletons) rather than building a parallel results UI

## Out of Scope

- Food-pairing questions (no backend support — deferred to whenever Pair is built)
- Any style-tier grouping in results (the recommendation engine doesn't produce one)
- Accounts / server-side profile storage
- Live re-scoring as the user fills out the form — submission is explicit

## Page Behavior

Single component state machine with two modes, no routing change (`/discover` stays one route):

1. **Form mode** (default, unless a stored profile exists — see Persistence): the questionnaire is shown.
2. **Results mode** (after submit, or on load if a stored profile exists): the form is replaced by the profile summary and ranked results. An "Edit preferences" button switches back to form mode, pre-filled with the last-submitted answers.

Submitting fetches `POST /api/recommendations` with the current answers. Loading shows the same skeleton-grid pattern as Explore. A request failure shows `ErrorMessage` with retry. Results paginate via the same "Load more" pattern already used on Explore (`limit`/`offset`, appending on click).

If the response's `profile.description` is empty (the user set no preferences at all), show "No specific preferences set — showing all wines, sorted alphabetically" in place of the profile summary box, rather than rendering nothing.

## Questionnaire Fields

| Field | Control | Options |
|---|---|---|
| Wine type | Select | No preference / Red / White / Rosé / Sparkling / Fortified (reuses the corrected Explore type list) |
| Country | Select | No preference / the same 10 countries used on Explore |
| Price range | Two number inputs | Min / Max, matching Explore's price filter inputs |
| Sweetness, Acidity, Tannin, Body, Fruit Intensity | Radio group, 6 options each | The 5 labeled levels from the recommendation engine's own label table, plus "I'm unsure" |

The 5-level labels per dimension **must match the backend's `LABELS` table in `app/services/recommendations.py` exactly** (e.g. sweetness: Very dry/Dry/Off-dry/Sweet/Very sweet), so a submitted answer of "Dry" and a returned profile line of "Dry" are the same word for the same value — this label table is duplicated intentionally on the frontend (no shared-package mechanism exists between the two codebases) and should be kept in sync by hand if the backend table ever changes.

"I'm unsure" maps to the field being omitted from the request entirely (not sent as `null`, not defaulted to a level) — consistent with the backend's `Optional[int]` fields and the whole "missing dimension" design from the recommendation engine.

## Match Card Extension

`WineCard` gains two new optional props: `matchScore?: number` and `explanation?: string[]`. When present (Discover results), it renders a corner badge over the bottle image (`{Math.round(matchScore * 100)}% Match`) and a muted one-line explanation below the existing price line, showing up to the first 3 explanation strings joined by " · ". When absent (Explore, unchanged), the card renders exactly as it does today — no behavior change for existing Explore usage. `WineGrid` is widened to accept items carrying optional `match_score`/`explanation` fields and passes them through to `WineCard`; Explore's existing plain `WineListItem[]` usage is unaffected since those fields are simply absent.

## Persistence

Questionnaire answers (the preference fields only — not pagination state) are saved to `localStorage` under `vinoscope-discover-profile` whenever the form is submitted. On mount, `DiscoverPage` checks for a stored profile: if one exists, the form is pre-filled from it **and** results are fetched immediately (skipping the extra click), landing the user straight in results mode. If none exists, the page starts in form mode with everything unanswered.

## Data Flow

- `frontend/src/types/wine.ts` gains `RecommendationAnswers` (the preference-only fields: `sweetness`/`acidity`/`tannin`/`body`/`fruitiness`/`type`/`country`/`min_price`/`max_price`, all optional), `RecommendationRequest` (extends `RecommendationAnswers` with `limit`/`offset`), `RecommendationItem` (extends `WineListItem` with `match_score: number` and `explanation: string[]`), and `RecommendationResponse` (`{ profile: { description: string[] }, total: number, items: RecommendationItem[] }`) — mirroring the backend's Pydantic schemas exactly.
- `frontend/src/services/api.ts` gains `getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse>` — a `POST` with a JSON body, unlike the existing `GET`-with-query-string `listWines`.
- A small refactor while touching this area: `FilterDrawer`'s hardcoded `TYPE_OPTIONS`/`TYPE_LABELS`/`COUNTRY_OPTIONS` move to a new shared `frontend/src/constants/wineOptions.ts`, imported by both `FilterDrawer` (Explore) and the new Discover form. This directly prevents a repeat of the type/country dropdown drift bug found and fixed earlier — one source of truth instead of two copies that can silently diverge from the real data.

## Component Architecture

```
frontend/src/
├── constants/
│   └── wineOptions.ts          TYPE_OPTIONS, TYPE_LABELS, COUNTRY_OPTIONS (moved from FilterDrawer)
├── utils/
│   ├── dimensionLabels.ts      the 5-dimension label table (mirrors backend LABELS) + display titles
│   └── discoverProfile.ts      localStorage get/set for the saved RecommendationAnswers
├── components/
│   ├── explore/
│   │   └── FilterDrawer.tsx    (modified: imports from constants/wineOptions instead of local copies)
│   ├── wine/
│   │   ├── WineCard.tsx        (modified: optional matchScore/explanation props)
│   │   └── WineGrid.tsx        (modified: widened item type)
│   └── discover/
│       ├── DimensionField.tsx  one dimension's radio group (5 levels + unsure)
│       ├── DiscoverForm.tsx    the whole questionnaire, owns draft state, calls onSubmit(answers)
│       └── ProfileSummary.tsx  renders profile.description, or the empty-profile fallback message
└── pages/
    └── DiscoverPage.tsx        owns form/results mode, fetch, pagination, localStorage read/write;
                                  moved out of StubPages.tsx (DiscoverPage's stub export is removed there)
```

`App.tsx` is updated to import `DiscoverPage` from `./pages/DiscoverPage` instead of `./pages/StubPages`.

## Testing Strategy

Same Vitest + React Testing Library conventions as the rest of the frontend, API layer mocked at `services/api.ts`:
- `DimensionField`: renders 6 options (5 levels + unsure), selecting one calls `onChange` with the right value, selecting "I'm unsure" calls `onChange(undefined)`
- `DiscoverForm`: submitting calls `onSubmit` with the current draft answers; pre-fills from `initialAnswers`
- `WineCard`: badge renders correctly from `matchScore` (percentage rounding), explanation line shows at most 3 items joined by " · ", and — critically — the existing Explore-usage tests (no `matchScore`/`explanation` passed) still render with no badge, confirming the extension doesn't change existing behavior
- `DiscoverPage`: form submission fetches and switches to results mode; a stored profile on mount pre-fills and auto-fetches; "Edit preferences" returns to form mode pre-filled; empty `profile.description` shows the fallback message; Load more appends; error state renders with retry
- `discoverProfile.ts` (localStorage helpers): round-trips a profile through set/get; a corrupted/missing value returns `null` rather than throwing

## Global Constraints

- No new runtime dependencies.
- The five dimension labels shown in the questionnaire must exactly match the backend's `LABELS` table strings (hand-kept in sync, documented above).
- "I'm unsure" always means the field is omitted from the request, never sent as an explicit value.
- `WineCard`'s existing Explore behavior must be unchanged when `matchScore`/`explanation` are not passed.
- Mobile-responsive down to phone width, consistent with the rest of the built (non-stub) pages.
