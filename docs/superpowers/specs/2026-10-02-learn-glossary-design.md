# Learn Page, Part 4: Glossary — Design

**Date:** 2026-10-02
**Status:** Approved in brainstorming; awaiting written-spec review
**Builds on:** Parts 1–3 (`2026-09-30-learn-page-framework-taste-design.md`,
`2026-09-30-learn-vine-to-glass-design.md`, `2026-10-01-learn-key-grapes-design.md`), all merged.

## Goal

Add the fourth Learn chapter, **Glossary**: about 40 core wine terms, searchable and filterable by
category, each with a plain definition and, where it fits, a link to where the idea shows up
elsewhere on the site plus links to related terms.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Terms | ~40 general terms drafted now, every entry `source: "general"`; course terms swapped in later |
| Layout | Search box + single-select category chips over an A–Z list of term cards |
| Categories | Tasting, Winemaking, Vineyard, Label & Law, Serving |
| Links | Optional "See it in …" link (chapter anchor or Explore filter) + 1–3 related-term chips |
| Deep links | `#term-<slug>` lands on the card |
| Art | None; the list stays text-first |
| Content source | `content/learn/glossary.ts` |

## Content

`GlossaryCategory = "tasting" | "winemaking" | "vineyard" | "label" | "serving"`, with display
labels in `GLOSSARY_CATEGORY_LABELS` ("Tasting", "Winemaking", "Vineyard", "Label & Law",
"Serving") and order in `GLOSSARY_CATEGORIES`.

Each term: `id` (URL-safe slug), `term` (display name), `category`, `definition` (1–2 plain
sentences, same voice as Parts 1–3), optional `seeAlso`, optional `related` (1–3 term ids),
`source`.

`seeAlso` is one of:
- `{ kind: "learn", anchor: string, label: string }` — an element id on the Learn page, rendered as
  a plain `<a href="#<anchor>">` so the browser scrolls natively ("See it in How to Taste →").
- `{ kind: "explore", params: { type?: WineStyle | "dessert"; country?: string }, label: string }` —
  rendered as a router `Link` to `/explore?<params>` ("Browse fortified wines →").

### Term list

| Category | Term (id) | See it in | Related |
|---|---|---|---|
| Tasting | Acidity (`acidity`) | `#taste-acidity-title` | balance, minerality |
| Tasting | Tannin (`tannin`) | `#taste-tannin-title` | maceration, oak-aging |
| Tasting | Body (`body`) | `#taste-body-title` | legs |
| Tasting | Dry (`dry`) | `#taste-sweetness-title` | off-dry, residual-sugar |
| Tasting | Off-dry (`off-dry`) | `#taste-sweetness-title` | dry, residual-sugar |
| Tasting | Finish (`finish`) | — | balance |
| Tasting | Aroma (`aroma`) | — | bouquet |
| Tasting | Bouquet (`bouquet`) | — | aroma, cellaring |
| Tasting | Legs (`legs`) | — | body |
| Tasting | Balance (`balance`) | — | acidity, tannin |
| Tasting | Minerality (`minerality`) | — | terroir |
| Winemaking | Fermentation (`fermentation`) | `#vine-ferment-title` | residual-sugar, malolactic |
| Winemaking | Maceration (`maceration`) | `#vine-crush-title` | tannin |
| Winemaking | Malolactic conversion (`malolactic`) | `#vine-ferment-title` | acidity, oak-aging |
| Winemaking | Lees (`lees`) | `#vine-age-title` | traditional-method |
| Winemaking | Oak aging (`oak-aging`) | `#vine-age-title` | tannin, malolactic |
| Winemaking | Residual sugar (`residual-sugar`) | — | dry, off-dry |
| Winemaking | Fortified (`fortified`) | Explore `type=fortified` | fermentation |
| Winemaking | Blend (`blend`) | — | varietal |
| Winemaking | Sulfites (`sulfites`) | `#vine-bottle-title` | oxidized |
| Winemaking | Traditional method (`traditional-method`) | Explore `type=sparkling` | lees, brut |
| Vineyard | Terroir (`terroir`) | `#vine-vineyard-title` | appellation, minerality |
| Vineyard | Vintage (`vintage`) | `#vine-harvest-title` | non-vintage |
| Vineyard | Varietal (`varietal`) | `#grapes` | blend, vitis-vinifera |
| Vineyard | *Vitis vinifera* (`vitis-vinifera`) | — | varietal, phylloxera |
| Vineyard | Old vines (`old-vines`) | — | terroir |
| Vineyard | Noble rot (`noble-rot`) | Explore `type=dessert` | residual-sugar |
| Vineyard | Phylloxera (`phylloxera`) | — | vitis-vinifera |
| Vineyard | Cool vs. warm climate (`climate`) | — | acidity, body |
| Label & Law | Appellation (`appellation`) | — | terroir, cru |
| Label & Law | Grand Cru / Premier Cru (`cru`) | — | appellation |
| Label & Law | Non-vintage (`non-vintage`) | — | vintage, blend |
| Label & Law | Old World (`old-world`) | Explore `country=France` | new-world |
| Label & Law | New World (`new-world`) | Explore `country=United States` | old-world |
| Label & Law | Estate bottled (`estate-bottled`) | — | appellation |
| Label & Law | Reserve (`reserve`) | — | oak-aging |
| Label & Law | Brut (`brut`) | Explore `type=sparkling` | dry, traditional-method |
| Serving | Decanting (`decanting`) | — | aeration |
| Serving | Aeration (`aeration`) | — | decanting |
| Serving | Serving temperature (`serving-temperature`) | `#vine-glass-title` | — |
| Serving | Corked (`corked`) | — | oxidized |
| Serving | Oxidized (`oxidized`) | — | sulfites, corked |
| Serving | Cellaring (`cellaring`) | — | bouquet |

43 terms. Learn labels: "See it in How to Taste", "See it in Vine to Glass", "See it in Key
Grapes". Explore labels: "Browse fortified wines", "Browse sparkling wines", "Browse dessert
wines", "Browse wines from France", "Browse wines from the United States". If a vine-stage
heading named above doesn't fit the definition once written, pick the closer stage; the content
test keeps every anchor valid.

`GLOSSARY_CHAPTER`: `id: "glossary"`, `label: "Glossary"`, `title: "Words to know"`, a lead line,
`source: "general"`.

## UI

**`GlossaryChapter`.** Holds `query` (string) and `category` (`GlossaryCategory | "all"`), derives
the visible terms with `filterTerms`, renders controls, count, list or empty state.

**`filterTerms(terms, query, category)`** (pure, in `glossarySearch.ts`). Category filter, then
query filter: the query and the term + definition are normalized (NFD, strip combining marks,
lowercase, trim); a term matches if its normalized text contains the normalized query. Empty
query matches all. Output sorted A–Z by `term` (`localeCompare`, base sensitivity).

**`GlossaryControls`.**
- Search: `<input type="search">` with a visible label "Search terms", placeholder "e.g. tannin".
- Chips: a `role="group"` labelled "Category" containing "All" + the five category buttons, each
  with `aria-pressed`; exactly one pressed. Same pill look as the grape picker chips; the row
  scrolls horizontally on phones.
- Count: a `role="status"` line: "43 terms", "1 term", "No terms match".

**`TermCard`.** `<article id="term-<slug>" class="scroll-mt-24" aria-labelledby>`: `<h3>` term
(`tabIndex={-1}` so it can take focus), a small category tag, the definition, the `seeAlso` link
(arrow in an `aria-hidden` span), and "Related:" followed by small chip links to each related
term's `#term-<slug>`.

**List.** A–Z; 2 columns from `md`, 1 on phones.

**Empty state.** "No terms match "<query>"" plus a "Clear search" button that resets query and
category to all.

## Related-term jumps

Clicking a related chip (`onJump(id)` from `GlossaryChapter`):
1. If the target isn't in the visible list, reset query to "" and category to "all".
2. Replace the hash with `#term-<id>` (`navigate(..., { replace: true })`, as the grape picker).
3. After render, scroll the card into view (`smooth`, or `auto` under reduced motion), focus its
   heading with `preventScroll`, and add a `term-flash` class for ~1.5 s (a short accent outline
   fade in `learn.css`; static outline under reduced motion).

The chips stay real `href="#term-<id>"` links (middle-click / copy-link work); the click handler
prevents default.

## Deep links

`/learn#term-<slug>` uses the existing `LearnPage` arrival logic (all cards render on mount, so the
target exists). The arrival does not flash the card.

## Chapter nav and home

`LEARN_CHAPTERS` becomes `[taste, vine, grapes, glossary]`. The home `LearnScene` copy adds a
mention of the glossary.

## Units

| Unit | File | Responsibility |
|---|---|---|
| content | `content/learn/glossary.ts` | Chapter, terms, category types/labels/order, `SeeAlso` type |
| search | `components/learn/glossary/glossarySearch.ts` | `normalize`, `filterTerms` |
| `GlossaryChapter` | `components/learn/glossary/GlossaryChapter.tsx` | State, jumps, count, empty state |
| `GlossaryControls` | `components/learn/glossary/GlossaryControls.tsx` | Search input + category chips |
| `TermCard` | `components/learn/glossary/TermCard.tsx` | One term |
| styles | `components/learn/learn.css` | `term-flash` |
| chapters | `components/learn/chapters.ts` | Append `glossary` |
| home | `components/home/scenes/LearnScene.tsx` | Copy |

## Testing

Vitest + Testing Library, test-first.

- **Content:** 43 terms; ids unique and match `^[a-z0-9-]+$`; every `category` known; definitions
  non-empty; `related` ids exist, aren't self, 1–3 long when present; every `learn` anchor is one
  the page renders (`taste-<dimension>-title`, `vine-<stage>-title`, or a chapter id); every
  `explore` `type` is a dataset type and `country` a dataset country.
- **`filterTerms`:** empty query → all, sorted A–Z; case-insensitive; accent-insensitive both
  ways; matches inside definitions; category filter; category + query combined.
- **`GlossaryControls`:** labelled search box; six chips with exactly one `aria-pressed="true"`;
  typing and clicking call the handlers.
- **`TermCard`:** id `term-<slug>`; heading, tag, definition; `learn` link `href="#anchor"`;
  `explore` link `href` encoded (`/explore?country=United%20States`); related chips link to
  `#term-<id>`.
- **`GlossaryChapter`:** all terms by default with count "43 terms"; search narrows and updates
  the count; category chip narrows; no matches → empty state, Clear restores all; related jump to
  a hidden term clears filters, replaces the hash, focuses the heading.
- **`LearnPage`:** nav lists four chapters; `/learn#term-tannin` scrolls the Tannin card into view.
- **Home:** `LearnScene` copy mentions the glossary.

## Out of scope

Part 5 (regions map), terms beyond the list, pronunciation, term tooltips in other chapters,
multi-select categories, and backend changes.
