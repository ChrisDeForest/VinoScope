# Learn Page, Part 4: Glossary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Glossary chapter to `/learn`: 43 wine terms in an A–Z card list with a search box and category chips, each term optionally linking to an earlier chapter or an Explore filter and to 1–3 related terms, deep-linkable via `#term-<slug>`.

**Architecture:** Static content in `content/learn/glossary.ts` feeds `GlossaryChapter`, which owns the search query and category, derives the visible terms with the pure `filterTerms` (`glossarySearch.ts`), and renders `GlossaryControls`, a live count, and `TermCard`s (or an empty state). Related-term chips call back into the chapter, which clears hiding filters, replaces the hash, scrolls/focuses the card, and flashes it. The chapter is appended to `LEARN_CHAPTERS`; `LearnPage`'s existing arrival scroll handles `#term-<slug>`.

**Tech Stack:** React 18, TypeScript, React Router 6, Tailwind 3, Vitest 2 + Testing Library (jsdom), `@testing-library/user-event`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-learn-glossary-design.md`

## Global Constraints

- All paths are relative to `frontend/` unless they start with `docs/` or `data/`.
- Run tests from `frontend/`: `npx vitest run <path>`; full suite `npx vitest run`; type-check + build `npm run build`. Baseline on `main`: 75 files, 548 tests, all passing.
- Test-first for every task: failing test, watch it fail, implement, watch it pass, commit.
- No new npm dependencies. No backend changes.
- All Learn copy lives in `src/content/learn/`; every entry carries `source: "general" | "course"` (all new entries `"general"`); never shown on the page.
- Tailwind color tokens are plain CSS variables (`--color-accent` etc.): opacity modifiers like `bg-accent/50` do NOT work.
- Arrow glyphs (`→`) go in an `aria-hidden="true"` span so link names don't include them.
- Files contain non-ASCII (`é`, `→`, `—`, `°`, `“”`). Save as UTF-8; after each commit verify touched files decode as UTF-8 (from the repo root: `git diff --name-only HEAD~1 | .venv/Scripts/python -c "import sys; [open(f,'rb').read().decode('utf-8') for f in sys.stdin.read().split()]; print('utf-8 ok')"`).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on branch `feature/learn-glossary` (the controller creates it before Task 1).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/content/learn/glossary.ts` (+ `glossary.test.ts`, `glossary.dataset.test.ts`) | Create | `GLOSSARY_CHAPTER`, `GLOSSARY_TERMS`, categories, `SeeAlso`, `termById` |
| `src/components/learn/glossary/glossarySearch.ts` (+ test) | Create | `normalize`, `filterTerms` |
| `src/components/learn/glossary/TermCard.tsx` (+ test) | Create | One term card; ids; links |
| `src/components/learn/glossary/GlossaryControls.tsx` (+ test) | Create | Search input + category chips |
| `src/components/learn/glossary/GlossaryChapter.tsx` (+ test) | Create | State, count, empty state, related jumps |
| `src/components/learn/learn.css` | Modify | `.term-flash` |
| `src/components/learn/chapters.ts` | Modify | Append `glossary` |
| `src/components/home/scenes/LearnScene.tsx` | Modify | Copy mentions the glossary |
| `src/pages/LearnPage.test.tsx`, `src/components/home/scenes/FeatureScenes.test.tsx` | Modify | Four chapters; `#term-` arrival; home copy |

---

### Task 1: Glossary content

**Files:**
- Create: `src/content/learn/glossary.ts`
- Test: `src/content/learn/glossary.test.ts`, `src/content/learn/glossary.dataset.test.ts`

**Interfaces:**
- Consumes: `ContentSource` from `./types`; `WineStyle` from `./vine`; for tests: `DIMENSIONS` (`../../utils/dimensionLabels`), `VINE_STAGES` (`./vine`), `GRAPES` (`./grapes`), `TASTE_CHAPTER`/`VINE_CHAPTER`/`GRAPES_CHAPTER`, `DATASET_ROWS` (`../../test/dataset`).
- Produces:
  - `type GlossaryCategory = "tasting" | "winemaking" | "vineyard" | "label" | "serving"`
  - `GLOSSARY_CATEGORIES: readonly GlossaryCategory[]` (that order)
  - `GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, string>`
  - `type ExploreType = WineStyle | "dessert"`
  - `type SeeAlso = { kind: "learn"; anchor: string; label: string } | { kind: "explore"; params: { type?: ExploreType; country?: string }; label: string }`
  - `interface GlossaryTerm { id: string; term: string; category: GlossaryCategory; definition: string; seeAlso?: SeeAlso; related?: readonly string[]; source: ContentSource }`
  - `GLOSSARY_CHAPTER` (`id: "glossary"`, `label: "Glossary"`, `title: "Words to know"`, `lead`, `source`)
  - `GLOSSARY_TERMS: readonly GlossaryTerm[]` (43, grouped by category in file; display order comes from `filterTerms`)
  - `termById(id: string): GlossaryTerm | undefined`

- [ ] **Step 1: Write the failing content test** — `src/content/learn/glossary.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { GRAPES, GRAPES_CHAPTER } from "./grapes";
import { TASTE_CHAPTER } from "./taste";
import { VINE_CHAPTER, VINE_STAGES } from "./vine";
import { GLOSSARY_CATEGORIES, GLOSSARY_CATEGORY_LABELS, GLOSSARY_CHAPTER, GLOSSARY_TERMS, termById } from "./glossary";

// Every element id the Learn page renders that a "See it in" link may target.
const LEARN_ANCHORS = new Set<string>([
  TASTE_CHAPTER.id,
  VINE_CHAPTER.id,
  GRAPES_CHAPTER.id,
  ...DIMENSIONS.map((dimension) => `taste-${dimension}-title`),
  ...VINE_STAGES.map((stage) => `vine-${stage.id}-title`),
  ...GRAPES.map((grape) => `grape-${grape.id}`),
]);

describe("Glossary content", () => {
  it("has chapter strings", () => {
    expect(GLOSSARY_CHAPTER.id).toBe("glossary");
    expect(GLOSSARY_CHAPTER.label).toBe("Glossary");
    expect(GLOSSARY_CHAPTER.title).toBe("Words to know");
    expect(GLOSSARY_CHAPTER.lead.trim()).not.toBe("");
  });

  it("has five labelled categories in order", () => {
    expect(GLOSSARY_CATEGORIES).toEqual(["tasting", "winemaking", "vineyard", "label", "serving"]);
    expect(GLOSSARY_CATEGORIES.map((category) => GLOSSARY_CATEGORY_LABELS[category])).toEqual([
      "Tasting",
      "Winemaking",
      "Vineyard",
      "Label & Law",
      "Serving",
    ]);
  });

  it("has 43 terms with unique, URL-safe ids", () => {
    expect(GLOSSARY_TERMS).toHaveLength(43);
    const ids = GLOSSARY_TERMS.map((term) => term.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("has terms in every category", () => {
    const counts = Object.fromEntries(
      GLOSSARY_CATEGORIES.map((category) => [category, GLOSSARY_TERMS.filter((term) => term.category === category).length])
    );
    expect(counts).toEqual({ tasting: 11, winemaking: 10, vineyard: 8, label: 8, serving: 6 });
  });

  it.each(GLOSSARY_TERMS.map((term) => [term.id, term] as const))("%s has copy and a source", (_id, term) => {
    expect(term.term.trim()).not.toBe("");
    expect(term.definition.trim()).not.toBe("");
    expect(GLOSSARY_CATEGORIES).toContain(term.category);
    expect(["general", "course"]).toContain(term.source);
  });

  it.each(GLOSSARY_TERMS.filter((term) => term.related).map((term) => [term.id, term] as const))(
    "%s relates to 1–3 other real terms",
    (_id, term) => {
      const related = term.related!;
      expect(related.length).toBeGreaterThanOrEqual(1);
      expect(related.length).toBeLessThanOrEqual(3);
      expect(new Set(related).size).toBe(related.length);
      for (const id of related) {
        expect(id).not.toBe(term.id);
        expect(termById(id), `${term.id} → ${id}`).toBeDefined();
      }
    }
  );

  it.each(
    GLOSSARY_TERMS.flatMap((term) => (term.seeAlso?.kind === "learn" ? [[term.id, term.seeAlso.anchor] as const] : []))
  )("%s links to a Learn anchor that exists (%s)", (_id, anchor) => {
    expect(LEARN_ANCHORS.has(anchor)).toBe(true);
  });

  it("every see-also link has a label and explore links have a filter", () => {
    for (const term of GLOSSARY_TERMS) {
      if (!term.seeAlso) continue;
      expect(term.seeAlso.label.trim()).not.toBe("");
      if (term.seeAlso.kind === "explore") expect(Object.keys(term.seeAlso.params).length).toBeGreaterThan(0);
    }
  });

  it("wires the spec's key links", () => {
    expect(termById("tannin")!.seeAlso).toEqual({ kind: "learn", anchor: "taste-tannin-title", label: "See it in How to Taste" });
    expect(termById("malolactic")!.seeAlso).toMatchObject({ kind: "learn", anchor: "vine-ferment-title" });
    expect(termById("varietal")!.seeAlso).toMatchObject({ kind: "learn", anchor: "grapes", label: "See it in Key Grapes" });
    expect(termById("fortified")!.seeAlso).toEqual({ kind: "explore", params: { type: "fortified" }, label: "Browse fortified wines" });
    expect(termById("new-world")!.seeAlso).toMatchObject({ kind: "explore", params: { country: "United States" } });
    expect(termById("noble-rot")!.seeAlso).toMatchObject({ params: { type: "dessert" } });
  });

  it("looks terms up by id", () => {
    expect(termById("tannin")!.term).toBe("Tannin");
    expect(termById("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write the failing dataset test** — `src/content/learn/glossary.dataset.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { GLOSSARY_TERMS } from "./glossary";

const TYPES = new Set(DATASET_ROWS.map((row) => row.type));
const COUNTRIES = new Set(DATASET_ROWS.map((row) => row.country));

const exploreLinks = GLOSSARY_TERMS.flatMap((term) =>
  term.seeAlso?.kind === "explore" ? [[term.id, term.seeAlso.params] as const] : []
);

describe("Glossary Explore links against the dataset", () => {
  it.each(exploreLinks)("%s filters on values the catalog has", (_id, params) => {
    if (params.type) expect(TYPES.has(params.type)).toBe(true);
    if (params.country) expect(COUNTRIES.has(params.country)).toBe(true);
  });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npx vitest run src/content/learn/glossary`
Expected: FAIL — cannot resolve `./glossary`.

- [ ] **Step 4: Write the content** — `src/content/learn/glossary.ts`

```ts
import type { ContentSource } from "./types";
import type { WineStyle } from "./vine";

export type GlossaryCategory = "tasting" | "winemaking" | "vineyard" | "label" | "serving";

export const GLOSSARY_CATEGORIES: readonly GlossaryCategory[] = ["tasting", "winemaking", "vineyard", "label", "serving"];

export const GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  tasting: "Tasting",
  winemaking: "Winemaking",
  vineyard: "Vineyard",
  label: "Label & Law",
  serving: "Serving",
};

/** Explore's `type` filter values: the vine chapter's styles plus dessert. */
export type ExploreType = WineStyle | "dessert";

export type SeeAlso =
  /** An element id on the Learn page; followed as a plain in-page anchor. */
  | { kind: "learn"; anchor: string; label: string }
  | { kind: "explore"; params: { type?: ExploreType; country?: string }; label: string };

export interface GlossaryTerm {
  /** URL-safe slug; also the deep-link anchor (`#term-<id>`). */
  id: string;
  term: string;
  category: GlossaryCategory;
  definition: string;
  seeAlso?: SeeAlso;
  /** 1–3 other term ids. */
  related?: readonly string[];
  source: ContentSource;
}

export const GLOSSARY_CHAPTER = {
  id: "glossary",
  label: "Glossary",
  title: "Words to know",
  lead: "The words you'll hear at tastings, on labels and in class, in plain language. Search for a term or pick a category, and follow the links to see each idea in action.",
  source: "general",
} as const satisfies { id: "glossary"; label: string; title: string; lead: string; source: ContentSource };

const TASTE = "See it in How to Taste";
const VINE = "See it in Vine to Glass";

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  // Tasting
  {
    id: "acidity",
    term: "Acidity",
    category: "tasting",
    definition: "The tart, mouth-watering quality that makes your cheeks pucker. It keeps a wine fresh and lively; too little and the wine tastes flat.",
    seeAlso: { kind: "learn", anchor: "taste-acidity-title", label: TASTE },
    related: ["balance", "minerality"],
    source: "general",
  },
  {
    id: "tannin",
    term: "Tannin",
    category: "tasting",
    definition: "Compounds from grape skins, seeds and oak that dry out your gums and grip your tongue, like strong black tea. Mostly found in reds, and they soften as a wine ages.",
    seeAlso: { kind: "learn", anchor: "taste-tannin-title", label: TASTE },
    related: ["maceration", "oak-aging"],
    source: "general",
  },
  {
    id: "body",
    term: "Body",
    category: "tasting",
    definition: "How heavy or full the wine feels in your mouth, from light like skim milk to full like whole milk. Alcohol is the biggest driver: more alcohol, more body.",
    seeAlso: { kind: "learn", anchor: "taste-body-title", label: TASTE },
    related: ["legs"],
    source: "general",
  },
  {
    id: "dry",
    term: "Dry",
    category: "tasting",
    definition: "A wine with little or no sugar left in it. Dry is about sweetness, not about the drying feeling of tannin.",
    seeAlso: { kind: "learn", anchor: "taste-sweetness-title", label: TASTE },
    related: ["off-dry", "residual-sugar"],
    source: "general",
  },
  {
    id: "off-dry",
    term: "Off-dry",
    category: "tasting",
    definition: "Just a touch sweet: enough sugar to soften the edges without tasting like dessert. Many Rieslings are made this way.",
    seeAlso: { kind: "learn", anchor: "taste-sweetness-title", label: TASTE },
    related: ["dry", "residual-sugar"],
    source: "general",
  },
  {
    id: "finish",
    term: "Finish",
    category: "tasting",
    definition: "How long the flavors linger after you swallow. A long finish is usually a sign of a well-made wine.",
    related: ["balance"],
    source: "general",
  },
  {
    id: "aroma",
    term: "Aroma",
    category: "tasting",
    definition: "The smells that come from the grape itself and from fermentation, like fruit, flowers or herbs. They're strongest in young wines.",
    related: ["bouquet"],
    source: "general",
  },
  {
    id: "bouquet",
    term: "Bouquet",
    category: "tasting",
    definition: "The more complex smells a wine develops as it ages in barrel or bottle, like leather, nuts, earth or dried fruit.",
    related: ["aroma", "cellaring"],
    source: "general",
  },
  {
    id: "legs",
    term: "Legs",
    category: "tasting",
    definition: "The streaks that run down the inside of the glass after you swirl. They hint at alcohol (and sometimes sugar), not quality.",
    related: ["body"],
    source: "general",
  },
  {
    id: "balance",
    term: "Balance",
    category: "tasting",
    definition: "When acidity, tannin, sweetness, alcohol and fruit all work together, with none sticking out. A balanced wine tastes whole rather than sharp, hot or flabby.",
    related: ["acidity", "tannin"],
    source: "general",
  },
  {
    id: "minerality",
    term: "Minerality",
    category: "tasting",
    definition: "Flavors that remind people of wet stone, chalk or flint, often in crisp whites from cool places. Where it comes from is still debated.",
    related: ["terroir"],
    source: "general",
  },
  // Winemaking
  {
    id: "fermentation",
    term: "Fermentation",
    category: "winemaking",
    definition: "Yeast turning grape sugar into alcohol and carbon dioxide. It's the step that turns juice into wine.",
    seeAlso: { kind: "learn", anchor: "vine-ferment-title", label: VINE },
    related: ["residual-sugar", "malolactic"],
    source: "general",
  },
  {
    id: "maceration",
    term: "Maceration",
    category: "winemaking",
    definition: "Soaking the juice with the grape skins to draw out color, tannin and flavor. Long for reds, a few hours for rosé, skipped for most whites.",
    seeAlso: { kind: "learn", anchor: "vine-crush-title", label: VINE },
    related: ["tannin"],
    source: "general",
  },
  {
    id: "malolactic",
    term: "Malolactic conversion",
    category: "winemaking",
    definition: "A second, bacterial conversion that turns sharp, green-apple-like malic acid into softer lactic acid. It gives many Chardonnays their rounder, buttery feel.",
    seeAlso: { kind: "learn", anchor: "vine-ferment-title", label: VINE },
    related: ["acidity", "oak-aging"],
    source: "general",
  },
  {
    id: "lees",
    term: "Lees",
    category: "winemaking",
    definition: "The spent yeast that settles after fermentation. Aging a wine on its lees (“sur lie”) adds a creamy texture and bready, nutty notes.",
    seeAlso: { kind: "learn", anchor: "vine-age-title", label: VINE },
    related: ["traditional-method"],
    source: "general",
  },
  {
    id: "oak-aging",
    term: "Oak aging",
    category: "winemaking",
    definition: "Resting wine in oak barrels, which let in a little air and add flavors like vanilla, toast and spice. New barrels flavor the wine more than old ones.",
    seeAlso: { kind: "learn", anchor: "vine-age-title", label: VINE },
    related: ["tannin", "malolactic"],
    source: "general",
  },
  {
    id: "residual-sugar",
    term: "Residual sugar",
    category: "winemaking",
    definition: "The grape sugar left in a wine when fermentation stops. It's what makes a wine taste sweet.",
    related: ["dry", "off-dry"],
    source: "general",
  },
  {
    id: "fortified",
    term: "Fortified",
    category: "winemaking",
    definition: "A wine with added grape spirit (brandy) that raises the alcohol, usually to 15–22%. Port, Sherry and Madeira are the classic examples.",
    seeAlso: { kind: "explore", params: { type: "fortified" }, label: "Browse fortified wines" },
    related: ["fermentation"],
    source: "general",
  },
  {
    id: "blend",
    term: "Blend",
    category: "winemaking",
    definition: "A wine made from more than one grape, like Bordeaux's mix of Cabernet Sauvignon and Merlot. Blending lets one grape's strengths cover another's weaknesses.",
    related: ["varietal"],
    source: "general",
  },
  {
    id: "sulfites",
    term: "Sulfites",
    category: "winemaking",
    definition: "Sulfur compounds that protect wine from spoiling and browning. Yeast makes a little on its own, and most winemakers add a bit more before bottling.",
    seeAlso: { kind: "learn", anchor: "vine-bottle-title", label: VINE },
    related: ["oxidized"],
    source: "general",
  },
  {
    id: "traditional-method",
    term: "Traditional method",
    category: "winemaking",
    definition: "The Champagne way of making sparkling wine: a second fermentation inside the bottle traps the bubbles. Time on the lees gives toasty, bready notes.",
    seeAlso: { kind: "explore", params: { type: "sparkling" }, label: "Browse sparkling wines" },
    related: ["lees", "brut"],
    source: "general",
  },
  // Vineyard
  {
    id: "terroir",
    term: "Terroir",
    category: "vineyard",
    definition: "A vineyard's whole growing environment: climate, soil, slope and sunlight. It's why the same grape tastes different from place to place.",
    seeAlso: { kind: "learn", anchor: "vine-vineyard-title", label: VINE },
    related: ["appellation", "minerality"],
    source: "general",
  },
  {
    id: "vintage",
    term: "Vintage",
    category: "vineyard",
    definition: "The year the grapes were harvested. Weather changes every year, so the same wine can taste different from one vintage to the next.",
    seeAlso: { kind: "learn", anchor: "vine-harvest-title", label: VINE },
    related: ["non-vintage"],
    source: "general",
  },
  {
    id: "varietal",
    term: "Varietal",
    category: "vineyard",
    definition: "A wine named after, and mostly made from, a single grape, like a Pinot Noir or a Chardonnay. Common in the New World.",
    seeAlso: { kind: "learn", anchor: "grapes", label: "See it in Key Grapes" },
    related: ["blend", "vitis-vinifera"],
    source: "general",
  },
  {
    id: "vitis-vinifera",
    term: "Vitis vinifera",
    category: "vineyard",
    definition: "The European grape vine species behind nearly all the world's fine wine, from Cabernet Sauvignon to Riesling.",
    related: ["varietal", "phylloxera"],
    source: "general",
  },
  {
    id: "old-vines",
    term: "Old vines",
    category: "vineyard",
    definition: "Vines that are decades old, often labeled “vieilles vignes.” They give fewer grapes, which many growers think make more concentrated wine; there's no legal age.",
    related: ["terroir"],
    source: "general",
  },
  {
    id: "noble-rot",
    term: "Noble rot",
    category: "vineyard",
    definition: "A helpful mold (Botrytis cinerea) that shrivels ripe grapes and concentrates their sugar. It makes famous sweet wines like Sauternes and Tokaji.",
    seeAlso: { kind: "explore", params: { type: "dessert" }, label: "Browse dessert wines" },
    related: ["residual-sugar"],
    source: "general",
  },
  {
    id: "phylloxera",
    term: "Phylloxera",
    category: "vineyard",
    definition: "A tiny aphid that destroyed most of Europe's vineyards in the late 1800s. Vines are still grafted onto resistant American roots to survive it.",
    related: ["vitis-vinifera"],
    source: "general",
  },
  {
    id: "climate",
    term: "Cool vs. warm climate",
    category: "vineyard",
    definition: "Cool places give wines with higher acidity, lighter body and tart fruit; warm places give riper fruit, more alcohol and fuller body.",
    related: ["acidity", "body"],
    source: "general",
  },
  // Label & Law
  {
    id: "appellation",
    term: "Appellation",
    category: "label",
    definition: "A legally defined wine region, like an AOC in France or an AVA in the United States. In Europe its rules can also set which grapes are allowed and how the wine is made.",
    related: ["terroir", "cru"],
    source: "general",
  },
  {
    id: "cru",
    term: "Grand Cru / Premier Cru",
    category: "label",
    definition: "French ranks for the best vineyards or estates: Grand Cru is the top tier, Premier Cru the next. What gets ranked, and how, differs by region.",
    related: ["appellation"],
    source: "general",
  },
  {
    id: "non-vintage",
    term: "Non-vintage (NV)",
    category: "label",
    definition: "A wine blended from several harvests, so there's no year on the label. Most Champagne is made this way to keep a steady house style.",
    related: ["vintage", "blend"],
    source: "general",
  },
  {
    id: "old-world",
    term: "Old World",
    category: "label",
    definition: "Europe's traditional winemaking countries, like France, Italy, Spain and Germany. Labels usually name the place, and the wines lean earthier and more restrained.",
    seeAlso: { kind: "explore", params: { country: "France" }, label: "Browse wines from France" },
    related: ["new-world"],
    source: "general",
  },
  {
    id: "new-world",
    term: "New World",
    category: "label",
    definition: "Winemaking countries beyond Europe, like the United States, Australia, Chile and New Zealand. Labels usually name the grape, and the wines lean riper and fruit-forward.",
    seeAlso: { kind: "explore", params: { country: "United States" }, label: "Browse wines from the United States" },
    related: ["old-world"],
    source: "general",
  },
  {
    id: "estate-bottled",
    term: "Estate bottled",
    category: "label",
    definition: "The winery grew the grapes in its own vineyards and made and bottled the wine itself. In the US it's a legally defined label term.",
    related: ["appellation"],
    source: "general",
  },
  {
    id: "reserve",
    term: "Reserve",
    category: "label",
    definition: "A label word that usually suggests a better or longer-aged wine. In Spain and Italy (Reserva, Riserva) it has legal aging rules; elsewhere it means whatever the winery wants.",
    related: ["oak-aging"],
    source: "general",
  },
  {
    id: "brut",
    term: "Brut",
    category: "label",
    definition: "Dry, the most common sweetness level for sparkling wine. Extra Brut and Brut Nature are drier still; Extra Dry is, confusingly, a little sweeter.",
    seeAlso: { kind: "explore", params: { type: "sparkling" }, label: "Browse sparkling wines" },
    related: ["dry", "traditional-method"],
    source: "general",
  },
  // Serving
  {
    id: "decanting",
    term: "Decanting",
    category: "serving",
    definition: "Pouring wine into another vessel before serving, either to leave the sediment of an old wine behind or to let a young wine breathe.",
    related: ["aeration"],
    source: "general",
  },
  {
    id: "aeration",
    term: "Aeration",
    category: "serving",
    definition: "Letting air into a wine, by swirling, decanting or just letting it sit, so its aromas open up and harsh edges soften.",
    related: ["decanting"],
    source: "general",
  },
  {
    id: "serving-temperature",
    term: "Serving temperature",
    category: "serving",
    definition: "How cold a wine is changes how it tastes. Sparkling and light whites are best well chilled, fuller whites a little warmer, and reds just below room temperature.",
    seeAlso: { kind: "learn", anchor: "vine-glass-title", label: VINE },
    source: "general",
  },
  {
    id: "corked",
    term: "Corked",
    category: "serving",
    definition: "A wine spoiled by a chemical called TCA, often from a tainted cork. It smells like wet cardboard or a musty basement, and the fruit is muted.",
    related: ["oxidized"],
    source: "general",
  },
  {
    id: "oxidized",
    term: "Oxidized",
    category: "serving",
    definition: "A wine that's had too much contact with air: flat, nutty and browning. Some styles, like many Sherries, are made to taste this way on purpose.",
    related: ["sulfites", "corked"],
    source: "general",
  },
  {
    id: "cellaring",
    term: "Cellaring",
    category: "serving",
    definition: "Storing wine to age it: dark, steady and cool (about 55°F / 13°C), bottles on their side. Most wines are made to drink young; only some improve with years.",
    related: ["bouquet"],
    source: "general",
  },
];

const BY_ID = new Map(GLOSSARY_TERMS.map((term) => [term.id, term]));

export function termById(id: string): GlossaryTerm | undefined {
  return BY_ID.get(id);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/content/learn/glossary`
Expected: PASS (both files).

- [ ] **Step 6: Commit**

```bash
git add src/content/learn/glossary.ts src/content/learn/glossary.test.ts src/content/learn/glossary.dataset.test.ts
git commit -m "feat(learn): add the glossary content

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the UTF-8 check from Global Constraints.

---

### Task 2: Search and filtering

**Files:**
- Create: `src/components/learn/glossary/glossarySearch.ts`
- Test: `src/components/learn/glossary/glossarySearch.test.ts`

**Interfaces:**
- Consumes: `GlossaryTerm`, `GlossaryCategory` from `../../../content/learn/glossary`.
- Produces:
  - `type CategoryFilter = GlossaryCategory | "all"`
  - `normalize(text: string): string` — NFD, strip combining marks (`\p{M}`), lowercase, trim.
  - `filterTerms(terms: readonly GlossaryTerm[], query: string, category: CategoryFilter): GlossaryTerm[]` — category filter, then normalized query contained in normalized `term + " " + definition`; result sorted by `term` with `localeCompare(b, undefined, { sensitivity: "base" })`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import type { GlossaryTerm } from "../../../content/learn/glossary";
import { GLOSSARY_TERMS } from "../../../content/learn/glossary";
import { filterTerms, normalize } from "./glossarySearch";

const t = (id: string, term: string, category: GlossaryTerm["category"], definition: string): GlossaryTerm => ({
  id,
  term,
  category,
  definition,
  source: "general",
});

const TERMS = [
  t("tannin", "Tannin", "tasting", "Grips your gums like black tea."),
  t("acidity", "Acidity", "tasting", "Makes your mouth water."),
  t("lees", "Lees", "winemaking", "Spent yeast; aged “sur lie” for a creamy feel."),
  t("semillon", "Sémillon", "vineyard", "A golden grape."),
];

const ids = (terms: readonly GlossaryTerm[]) => terms.map((term) => term.id);

describe("normalize", () => {
  it("lowercases, trims and strips accents", () => {
    expect(normalize("  Sémillon ")).toBe("semillon");
    expect(normalize("ROSÉ")).toBe("rose");
  });
});

describe("filterTerms", () => {
  it("returns everything A–Z for an empty query and all categories", () => {
    expect(ids(filterTerms(TERMS, "", "all"))).toEqual(["acidity", "lees", "semillon", "tannin"]);
    expect(ids(filterTerms(TERMS, "   ", "all"))).toHaveLength(4);
  });

  it("matches the term case-insensitively", () => {
    expect(ids(filterTerms(TERMS, "TANN", "all"))).toEqual(["tannin"]);
  });

  it("ignores accents both ways", () => {
    expect(ids(filterTerms(TERMS, "semillon", "all"))).toEqual(["semillon"]);
    expect(ids(filterTerms(TERMS, "Tännin", "all"))).toEqual(["tannin"]);
  });

  it("matches inside definitions", () => {
    expect(ids(filterTerms(TERMS, "black tea", "all"))).toEqual(["tannin"]);
    expect(ids(filterTerms(TERMS, "sur lie", "all"))).toEqual(["lees"]);
  });

  it("filters by category, alone and with a query", () => {
    expect(ids(filterTerms(TERMS, "", "tasting"))).toEqual(["acidity", "tannin"]);
    expect(ids(filterTerms(TERMS, "water", "tasting"))).toEqual(["acidity"]);
    expect(ids(filterTerms(TERMS, "water", "winemaking"))).toEqual([]);
  });

  it("does not mutate its input", () => {
    const before = ids(TERMS);
    filterTerms(TERMS, "", "all");
    expect(ids(TERMS)).toEqual(before);
  });

  it("sorts the real glossary alphabetically", () => {
    const names = filterTerms(GLOSSARY_TERMS, "", "all").map((term) => term.term);
    expect(names[0]).toBe("Acidity");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/learn/glossary/glossarySearch.test.ts`
Expected: FAIL — cannot resolve `./glossarySearch`.

- [ ] **Step 3: Implement** — `src/components/learn/glossary/glossarySearch.ts`

```ts
import type { GlossaryCategory, GlossaryTerm } from "../../../content/learn/glossary";

export type CategoryFilter = GlossaryCategory | "all";

/** Case- and accent-insensitive form, so "semillon" finds "Sémillon". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function filterTerms(terms: readonly GlossaryTerm[], query: string, category: CategoryFilter): GlossaryTerm[] {
  const needle = normalize(query);
  return terms
    .filter((term) => category === "all" || term.category === category)
    .filter((term) => !needle || normalize(`${term.term} ${term.definition}`).includes(needle))
    .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/learn/glossary/glossarySearch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/glossary/glossarySearch.ts src/components/learn/glossary/glossarySearch.test.ts
git commit -m "feat(learn): add accent-insensitive glossary filtering

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: TermCard

**Files:**
- Create: `src/components/learn/glossary/TermCard.tsx`
- Test: `src/components/learn/glossary/TermCard.test.tsx`

**Interfaces:**
- Consumes: `GlossaryTerm`, `SeeAlso`, `GLOSSARY_CATEGORY_LABELS`, `termById` from content.
- Produces:
  - `termCardId(id: string): string` → `` `term-${id}` ``
  - `termHeadingId(id: string): string` → `` `term-${id}-title` ``
  - `exploreHref(params: { type?: string; country?: string }): string` → `/explore?` + `key=encodeURIComponent(value)` pairs joined by `&` (spaces as `%20`, not `+`)
  - `TermCard({ term, flash, onJump }: { term: GlossaryTerm; flash: boolean; onJump: (id: string) => void })`

Markup: `<article id={termCardId} aria-labelledby={termHeadingId} className="scroll-mt-24 rounded border border-surface-border bg-surface-raised p-5 {flash ? 'term-flash' : ''}">`; `<h3 id tabIndex={-1} className="font-serif text-xl text-ink focus:outline-none">`; category tag `<p className="text-xs uppercase tracking-[0.2em] text-ink-muted">`; definition `<p className="mt-2 text-ink">`; seeAlso: `learn` → `<a href="#anchor">`, `explore` → router `<Link to={exploreHref(params)}>`, both `text-sm text-accent hover:underline` with `{label} <span aria-hidden="true">→</span>`; related: `<p className="mt-3 text-sm text-ink-muted">Related: </p>` followed by chips `<a href="#term-<id>" className="rounded-full border border-surface-border px-2.5 py-0.5 text-xs text-ink-muted hover:text-ink">` whose `onClick` calls `event.preventDefault(); onJump(id)`. Unknown related ids are skipped (`termById` undefined).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { termById } from "../../../content/learn/glossary";
import { TermCard, exploreHref, termCardId, termHeadingId } from "./TermCard";

function renderCard(id: string, flash = false, onJump = vi.fn()) {
  render(
    <MemoryRouter>
      <TermCard term={termById(id)!} flash={flash} onJump={onJump} />
    </MemoryRouter>
  );
  return onJump;
}

describe("ids and hrefs", () => {
  it("builds card and heading ids", () => {
    expect(termCardId("tannin")).toBe("term-tannin");
    expect(termHeadingId("tannin")).toBe("term-tannin-title");
  });

  it("encodes Explore params with %20", () => {
    expect(exploreHref({ country: "United States" })).toBe("/explore?country=United%20States");
    expect(exploreHref({ type: "rosé" })).toBe("/explore?type=ros%C3%A9");
  });
});

describe("TermCard", () => {
  it("renders an article labelled by its heading, with the deep-link id", () => {
    renderCard("tannin");
    const card = screen.getByRole("article", { name: "Tannin" });
    expect(card).toHaveAttribute("id", "term-tannin");
    expect(card).toHaveClass("scroll-mt-24");
    expect(screen.getByRole("heading", { level: 3, name: "Tannin" })).toHaveAttribute("tabindex", "-1");
  });

  it("shows the category and definition", () => {
    renderCard("tannin");
    expect(screen.getByText("Tasting")).toBeInTheDocument();
    expect(screen.getByText(/grip your tongue/)).toBeInTheDocument();
  });

  it("links a Learn see-also to the in-page anchor", () => {
    renderCard("tannin");
    expect(screen.getByRole("link", { name: "See it in How to Taste" })).toHaveAttribute("href", "#taste-tannin-title");
  });

  it("links an Explore see-also to the filter", () => {
    renderCard("new-world");
    expect(screen.getByRole("link", { name: "Browse wines from the United States" })).toHaveAttribute(
      "href",
      "/explore?country=United%20States"
    );
  });

  it("omits the see-also link when there is none", () => {
    renderCard("finish");
    expect(screen.queryByRole("link", { name: /See it in|Browse/ })).not.toBeInTheDocument();
  });

  it("renders related chips that jump instead of navigating", async () => {
    const onJump = renderCard("tannin");
    const chip = screen.getByRole("link", { name: "Maceration" });
    expect(chip).toHaveAttribute("href", "#term-maceration");
    expect(screen.getByRole("link", { name: "Oak aging" })).toHaveAttribute("href", "#term-oak-aging");
    await userEvent.click(chip);
    expect(onJump).toHaveBeenCalledWith("maceration");
  });

  it("has no related row for a term without related terms", () => {
    renderCard("serving-temperature");
    expect(screen.queryByText(/Related/)).not.toBeInTheDocument();
  });

  it("adds the flash class only when flashing", () => {
    renderCard("tannin", true);
    expect(screen.getByRole("article")).toHaveClass("term-flash");
  });

  it("does not flash by default", () => {
    renderCard("tannin");
    expect(screen.getByRole("article")).not.toHaveClass("term-flash");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/learn/glossary/TermCard.test.tsx`
Expected: FAIL — cannot resolve `./TermCard`.

- [ ] **Step 3: Implement** — `src/components/learn/glossary/TermCard.tsx`

```tsx
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { GLOSSARY_CATEGORY_LABELS, termById, type GlossaryTerm } from "../../../content/learn/glossary";

export function termCardId(id: string): string {
  return `term-${id}`;
}

export function termHeadingId(id: string): string {
  return `term-${id}-title`;
}

// Built by hand so spaces encode as %20, matching the rest of the Learn links.
export function exploreHref(params: { type?: string; country?: string }): string {
  const query = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join("&");
  return `/explore?${query}`;
}

const LINK_CLASS =
  "text-sm text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

interface TermCardProps {
  term: GlossaryTerm;
  flash: boolean;
  onJump: (id: string) => void;
}

export function TermCard({ term, flash, onJump }: TermCardProps) {
  const headingId = termHeadingId(term.id);
  const related = (term.related ?? []).flatMap((id) => {
    const target = termById(id);
    return target ? [target] : [];
  });
  const { seeAlso } = term;

  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    // The href stays real for copy-link and new tabs; a plain click jumps in place.
    event.preventDefault();
    onJump(id);
  }

  return (
    <article
      id={termCardId(term.id)}
      aria-labelledby={headingId}
      className={`scroll-mt-24 rounded border border-surface-border bg-surface-raised p-5 ${flash ? "term-flash" : ""}`}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{GLOSSARY_CATEGORY_LABELS[term.category]}</p>
      <h3 id={headingId} tabIndex={-1} className="mt-1 font-serif text-xl text-ink focus:outline-none">
        {term.term}
      </h3>
      <p className="mt-2 text-ink">{term.definition}</p>
      {seeAlso ? (
        <p className="mt-3">
          {seeAlso.kind === "learn" ? (
            <a href={`#${seeAlso.anchor}`} className={LINK_CLASS}>
              {seeAlso.label} <span aria-hidden="true">→</span>
            </a>
          ) : (
            <Link to={exploreHref(seeAlso.params)} className={LINK_CLASS}>
              {seeAlso.label} <span aria-hidden="true">→</span>
            </Link>
          )}
        </p>
      ) : null}
      {related.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span>Related:</span>
          {related.map((target) => (
            <a
              key={target.id}
              href={`#${termCardId(target.id)}`}
              onClick={(event) => jump(event, target.id)}
              className="rounded-full border border-surface-border px-2.5 py-0.5 text-xs text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {target.term}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/learn/glossary/TermCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/glossary/TermCard.tsx src/components/learn/glossary/TermCard.test.tsx
git commit -m "feat(learn): add the glossary term card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the UTF-8 check.

---

### Task 4: GlossaryControls

**Files:**
- Create: `src/components/learn/glossary/GlossaryControls.tsx`
- Test: `src/components/learn/glossary/GlossaryControls.test.tsx`

**Interfaces:**
- Consumes: `GLOSSARY_CATEGORIES`, `GLOSSARY_CATEGORY_LABELS`; `CategoryFilter` from `./glossarySearch`.
- Produces: `GlossaryControls({ query, onQueryChange, category, onCategoryChange }: { query: string; onQueryChange: (query: string) => void; category: CategoryFilter; onCategoryChange: (category: CategoryFilter) => void })`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryFilter } from "./glossarySearch";
import { GlossaryControls } from "./GlossaryControls";

function Harness({ onQuery = vi.fn(), onCategory = vi.fn() }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  return (
    <GlossaryControls
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        onQuery(value);
      }}
      category={category}
      onCategoryChange={(value) => {
        setCategory(value);
        onCategory(value);
      }}
    />
  );
}

describe("GlossaryControls", () => {
  it("has a labelled search box", async () => {
    const onQuery = vi.fn();
    render(<Harness onQuery={onQuery} />);
    const box = screen.getByRole("searchbox", { name: "Search terms" });
    await userEvent.type(box, "oak");
    expect(box).toHaveValue("oak");
    expect(onQuery).toHaveBeenLastCalledWith("oak");
  });

  it("offers All plus five category chips with exactly one pressed", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Category" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["All", "Tasting", "Winemaking", "Vineyard", "Label & Law", "Serving"]);
    expect(chips.filter((chip) => chip.getAttribute("aria-pressed") === "true")).toEqual([chips[0]]);
  });

  it("moves the pressed state to the clicked chip", async () => {
    const onCategory = vi.fn();
    render(<Harness onCategory={onCategory} />);
    await userEvent.click(screen.getByRole("button", { name: "Vineyard" }));
    expect(onCategory).toHaveBeenCalledWith("vineyard");
    expect(screen.getByRole("button", { name: "Vineyard" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/learn/glossary/GlossaryControls.test.tsx`
Expected: FAIL — cannot resolve `./GlossaryControls`.

- [ ] **Step 3: Implement** — `src/components/learn/glossary/GlossaryControls.tsx`

```tsx
import { GLOSSARY_CATEGORIES, GLOSSARY_CATEGORY_LABELS } from "../../../content/learn/glossary";
import type { CategoryFilter } from "./glossarySearch";

const OPTIONS: ReadonlyArray<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "All" },
  ...GLOSSARY_CATEGORIES.map((category) => ({ value: category, label: GLOSSARY_CATEGORY_LABELS[category] })),
];

interface GlossaryControlsProps {
  query: string;
  onQueryChange: (query: string) => void;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
}

export function GlossaryControls({ query, onQueryChange, category, onCategoryChange }: GlossaryControlsProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="glossary-search" className="block text-sm text-ink-muted mb-1">
          Search terms
        </label>
        <input
          id="glossary-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="e.g. tannin"
          className="w-full md:max-w-sm rounded border border-surface-border bg-surface-raised px-3 py-2 text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
      <div role="group" aria-label="Category" className="flex items-center gap-2 overflow-x-auto py-1">
        {OPTIONS.map(({ value, label }) => {
          const pressed = value === category;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              onClick={() => onCategoryChange(value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                pressed ? "border-accent text-accent" : "border-surface-border text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/learn/glossary/GlossaryControls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/glossary/GlossaryControls.tsx src/components/learn/glossary/GlossaryControls.test.tsx
git commit -m "feat(learn): add the glossary search box and category chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: GlossaryChapter with related-term jumps

**Files:**
- Create: `src/components/learn/glossary/GlossaryChapter.tsx`
- Modify: `src/components/learn/learn.css` (append `.term-flash`)
- Test: `src/components/learn/glossary/GlossaryChapter.test.tsx`

**Interfaces:**
- Consumes: `GLOSSARY_TERMS`; `filterTerms`, `CategoryFilter` (Task 2); `TermCard`, `termCardId`, `termHeadingId` (Task 3); `GlossaryControls` (Task 4); `usePrefersReducedMotion` from `../../../hooks/usePrefersReducedMotion`.
- Produces: `GlossaryChapter(): JSX.Element`; constant `FLASH_MS = 1500` (module-local).

Behavior:
- Count line: `<p role="status">` with `"{n} terms"`, `"1 term"`, or `"No terms match"` when 0.
- List: `<div className="mt-6 grid gap-4 md:grid-cols-2">` of `TermCard`s.
- Empty state (0 visible): `<p>No terms match “{query.trim()}”.</p>` plus `<button>Clear search</button>` resetting query to `""` and category to `"all"`.
- `jump(id)`: if `id` isn't in the visible list, reset query and category; `navigate({ pathname, search, hash: "#term-<id>" }, { replace: true })`; set a pending jump `{ id }` (a fresh object each time). An effect on the pending jump runs after render: `document.getElementById(termCardId(id))?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })`, `document.getElementById(termHeadingId(id))?.focus({ preventScroll: true })`, sets `flash` to that same object, clears the pending jump. A second effect on `flash` clears it after `FLASH_MS` (cleanup clears the timer). `TermCard flash={flash?.id === term.id}`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { GlossaryChapter } from "./GlossaryChapter";

const scrollIntoView = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function LocationProbe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash} {type}
    </p>
  );
}

function renderAt(path = "/learn") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <GlossaryChapter />
      <LocationProbe />
    </MemoryRouter>
  );
}

const cards = () => screen.queryAllByRole("article");
const count = () => screen.getByRole("status").textContent;

describe("GlossaryChapter", () => {
  it("shows every term A–Z with a count", () => {
    renderAt();
    expect(cards()).toHaveLength(43);
    expect(count()).toBe("43 terms");
    expect(within(cards()[0]).getByRole("heading").textContent).toBe("Acidity");
  });

  it("narrows by search and updates the count", async () => {
    renderAt();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search terms" }), "phylloxera");
    expect(cards()).toHaveLength(1);
    expect(count()).toBe("1 term");
  });

  it("narrows by category", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Serving" }));
    expect(cards()).toHaveLength(6);
    expect(count()).toBe("6 terms");
  });

  it("shows an empty state that clears back to everything", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Serving" }));
    await userEvent.type(screen.getByRole("searchbox"), "zzzz");
    expect(cards()).toHaveLength(0);
    expect(count()).toBe("No terms match");
    expect(screen.getByText("No terms match “zzzz”.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(cards()).toHaveLength(43);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("jumps to a related term: hash replaced, card scrolled, heading focused, card flashed", async () => {
    renderAt("/learn?x=1");
    const tannin = screen.getByRole("article", { name: "Tannin" });
    await userEvent.click(within(tannin).getByRole("link", { name: "Maceration" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/learn?x=1#term-maceration REPLACE");
    const target = document.getElementById("term-maceration")!;
    expect(scrollIntoView.mock.instances.at(-1)).toBe(target);
    expect(document.activeElement).toBe(document.getElementById("term-maceration-title"));
    expect(target).toHaveClass("term-flash");
  });

  it("clears filters that would hide the related term", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Tasting" }));
    const tannin = screen.getByRole("article", { name: "Tannin" });
    await userEvent.click(within(tannin).getByRole("link", { name: "Maceration" }));
    expect(screen.getByRole("article", { name: "Maceration" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(43);
  });

  it("keeps filters when the related term is already visible", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Tasting" }));
    const dry = screen.getByRole("article", { name: "Dry" });
    await userEvent.click(within(dry).getByRole("link", { name: "Off-dry" }));
    expect(screen.getByRole("button", { name: "Tasting" })).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(11);
  });

  it("stops flashing after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAt();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(within(screen.getByRole("article", { name: "Tannin" })).getByRole("link", { name: "Maceration" }));
      expect(document.getElementById("term-maceration")).toHaveClass("term-flash");
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(document.getElementById("term-maceration")).not.toHaveClass("term-flash");
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/learn/glossary/GlossaryChapter.test.tsx`
Expected: FAIL — cannot resolve `./GlossaryChapter`.

- [ ] **Step 3: Implement** — `src/components/learn/glossary/GlossaryChapter.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GLOSSARY_TERMS } from "../../../content/learn/glossary";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { GlossaryControls } from "./GlossaryControls";
import { filterTerms, type CategoryFilter } from "./glossarySearch";
import { TermCard, termCardId, termHeadingId } from "./TermCard";

const FLASH_MS = 1500;

// A fresh object per jump, so jumping to the same term twice still re-runs the effects.
type Jump = { id: string };

function countLabel(n: number): string {
  if (n === 0) return "No terms match";
  return n === 1 ? "1 term" : `${n} terms`;
}

export function GlossaryChapter() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [pendingJump, setPendingJump] = useState<Jump | null>(null);
  const [flash, setFlash] = useState<Jump | null>(null);
  const visible = useMemo(() => filterTerms(GLOSSARY_TERMS, query, category), [query, category]);

  function clearFilters() {
    setQuery("");
    setCategory("all");
  }

  function jump(id: string) {
    if (!visible.some((term) => term.id === id)) clearFilters();
    // Replace, like the grape picker, so hopping between terms doesn't fill the back button.
    navigate({ pathname: location.pathname, search: location.search, hash: `#${termCardId(id)}` }, { replace: true });
    setPendingJump({ id });
  }

  // Runs after the render that un-hid the target, so the card exists to scroll to.
  useEffect(() => {
    if (!pendingJump) return;
    document.getElementById(termCardId(pendingJump.id))?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    document.getElementById(termHeadingId(pendingJump.id))?.focus({ preventScroll: true });
    setFlash(pendingJump);
    setPendingJump(null);
  }, [pendingJump, reducedMotion]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return (
    <div className="mt-8">
      <GlossaryControls query={query} onQueryChange={setQuery} category={category} onCategoryChange={setCategory} />
      <p role="status" className="mt-4 text-sm text-ink-muted">
        {countLabel(visible.length)}
      </p>
      {visible.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {visible.map((term) => (
            <TermCard key={term.id} term={term} flash={flash?.id === term.id} onJump={jump} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded border border-surface-border bg-surface-raised p-6 text-center">
          <p className="text-ink">No terms match “{query.trim()}”.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Append the flash style** — end of `src/components/learn/learn.css`

```css
/* A related-term jump briefly outlines the card it lands on; static under reduced motion. */
.term-flash {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .term-flash {
    animation: term-flash 1.5s ease-out forwards;
  }
}

@keyframes term-flash {
  0%,
  40% {
    outline-color: var(--color-accent);
  }
  100% {
    outline-color: transparent;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/learn/glossary`
Expected: PASS (all glossary component tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/learn/glossary/GlossaryChapter.tsx src/components/learn/glossary/GlossaryChapter.test.tsx src/components/learn/learn.css
git commit -m "feat(learn): add the Glossary chapter with related-term jumps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the UTF-8 check.

---

### Task 6: Wire the chapter into Learn and the home page

**Files:**
- Modify: `src/components/learn/chapters.ts`
- Modify: `src/components/home/scenes/LearnScene.tsx`
- Test: `src/pages/LearnPage.test.tsx`, `src/components/home/scenes/FeatureScenes.test.tsx`

**Interfaces:**
- Consumes: `GLOSSARY_CHAPTER` (Task 1), `GlossaryChapter` (Task 5).
- Produces: `LEARN_CHAPTERS` = `[taste, vine, grapes, glossary]`.

- [ ] **Step 1: Update the LearnPage tests** — in `src/pages/LearnPage.test.tsx`, replace the `"lists all three chapters in the nav"` test with:

```tsx
  it("lists all four chapters in the nav", () => {
    renderAt("/learn");
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "How to Taste",
      "Vine to Glass",
      "Key Grapes",
      "Glossary",
    ]);
  });

  it("renders the Glossary chapter fourth", () => {
    renderAt("/learn");
    expect(screen.getByRole("region", { name: "Words to know" })).toHaveAttribute("id", "glossary");
    expect(screen.getByText("04 · Glossary")).toBeInTheDocument();
  });

  it("scrolls to a glossary term from the hash on arrival", () => {
    renderAt("/learn#term-tannin");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("term-tannin"));
  });
```

- [ ] **Step 2: Update the home test** — in `src/components/home/scenes/FeatureScenes.test.tsx`, add to the `"describes the Learn chapters"` test:

```tsx
    expect(screen.getByText(/glossary/i)).toBeInTheDocument();
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx`
Expected: FAIL — nav has three links; no "Words to know" region; no `term-tannin` element; no glossary copy.

- [ ] **Step 4: Register the chapter** — `src/components/learn/chapters.ts`: add the imports

```ts
import { GLOSSARY_CHAPTER } from "../../content/learn/glossary";
import { GlossaryChapter } from "./glossary/GlossaryChapter";
```

and append to `LEARN_CHAPTERS` after the grapes entry:

```ts
  {
    id: GLOSSARY_CHAPTER.id,
    label: GLOSSARY_CHAPTER.label,
    title: GLOSSARY_CHAPTER.title,
    lead: GLOSSARY_CHAPTER.lead,
    Component: GlossaryChapter,
  },
```

- [ ] **Step 5: Update the home copy** — in `src/components/home/scenes/LearnScene.tsx`, replace the paragraph text with:

```tsx
        Learn the five things your mouth is measuring, with real wines to taste the difference — then follow a grape
        from the vineyard to your glass, meet the seven grapes worth knowing, and look up any word in the glossary.
```

- [ ] **Step 6: Run the targeted tests, then everything**

Run: `npx vitest run src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx`
Expected: PASS.

Run: `npx vitest run`
Expected: all pass (baseline 548 + the new glossary tests). If an existing test now finds two matches for a word the glossary also uses (e.g. `getByText` / `getByRole("heading", { name })` on the whole Learn page), scope that query to its own chapter region with `within(screen.getByRole("region", { name: ... }))` rather than changing the glossary.

Run: `npm run build`
Expected: type-check and build succeed.

- [ ] **Step 7: Commit**

```bash
git add src/components/learn/chapters.ts src/components/home/scenes/LearnScene.tsx src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx
git commit -m "feat(learn): add Glossary as the fourth Learn chapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the UTF-8 check.
