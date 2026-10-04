# Learn Page — Follow-ups

All five Learn chapters are merged to `main` (How to Taste, Vine to Glass, Key Grapes, Glossary,
Wine Regions). These items are still open.

## Content

- [ ] **Swap in course notes.** Nearly all Learn copy in `frontend/src/content/learn/` is written
  from general wine knowledge and tagged `source: "general"`. Only the How to Taste dimension
  entries are tagged `source: "course"`, after confirming they match class. Share notebook photos
  or the course wine list, then update wording to the course's terms and mark matching entries
  `source: "course"`. Biggest payoff: the Glossary (`glossary.ts`), then the region write-ups
  (`regions.ts`).
- [ ] **Fix the Grand Cru / Premier Cru glossary wording.** The `cru` definition in
  `frontend/src/content/learn/glossary.ts` says Champagne's ranks apply to "vineyards"; in
  Champagne they apply to villages. One-line fix.

## Dataset

- [ ] **Add more wines to even out the dataset.** No wine currently scores 1 on acidity or
  fruitiness. After adding wines, revisit How to Taste's low-vs-high example pairs
  (`frontend/src/content/learn/taste.ts`) so each dimension shows a true low end.

## Wine Regions map

- [ ] **Deeper zoom for small countries.** `MAX_ZOOM` is 12 (`frontend/src/components/learn/regions/geo.ts`),
  so Italy, France, Germany, Portugal, Spain and Hungary hit the cap; Hungary fills only about 20%
  of the map. Raising it pairs with the next item.
- [ ] **Match neighbor borders at country zoom.** Wine countries use detailed (1:50m) outlines but
  their neighbors use 1:110m, so shared borders (e.g. near the Alps) don't line up exactly when
  zoomed. Add 50m outlines for neighbors to `frontend/scripts/build-map-data.mjs` (rerun
  `npm run build:map`); this needs a larger map-data size budget than the current 350 KB.
- [ ] **Pins resize mid-glide.** Pin sizes use the final zoom while the zoom transition is still
  animating, so pins briefly shrink/grow (e.g. closing the drawer on the United States). Cosmetic.
- [ ] **Emilia-Romagna's label is hidden on narrow phones** (~390 px) because its pin sits close to
  Tuscany and Veneto. The pin and the drawer's region list still work; a deeper zoom would make
  room for the label.
- [ ] **Minor robustness notes from the final review:** in Safari, clicking a button doesn't focus
  it, so closing the drawer can return focus to an older element; the 28 px pin hit areas can
  overlap a close neighbor on phones; on maps drawn wider than 1200 px the outline draw-in may
  end slightly early.
