import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SortOption } from "../../types/wine";
import { DEFAULT_FILTERS, SORT_OPTIONS, countActiveFilters, type FilterValues } from "./filterTypes";
import { typeLabel } from "../../constants/wineOptions";
import { priceRangeError, rangeError } from "../../utils/priceRange";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { useWineFacets } from "../../hooks/useWineFacets";
import { NumberStepperField } from "../common/NumberStepperField";
import { TasteRangeField } from "./TasteRangeField";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FIELD = "w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink";
const LABELLED = "flex flex-col gap-1 text-sm text-ink-muted";
// Used when the catalog's vintage range is unknown (facets failed or no wine has a vintage).
const FALLBACK_FIRST_YEAR = 1990;

function toNumber(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

function fromNumber(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

/** Newest first; always includes `extra` years (e.g. from a shared link) so the select can show them. */
function yearOptions(first: number, last: number, extra: string[]): string[] {
  const years = new Set<string>();
  for (let year = last; year >= first; year--) years.add(String(year));
  extra.filter(Boolean).forEach((year) => years.add(year));
  return [...years].sort((a, b) => Number(b) - Number(a));
}

function validate(draft: FilterValues): string | null {
  return (
    priceRangeError(toNumber(draft.minPrice), toNumber(draft.maxPrice)) ??
    rangeError(toNumber(draft.minAbv), toNumber(draft.maxAbv), "alcohol") ??
    (draft.vintageFrom && draft.vintageTo && Number(draft.vintageFrom) > Number(draft.vintageTo)
      ? "The first vintage must not be after the last."
      : null)
  );
}

function FilterGroup({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h3 id={id} className="text-xs font-semibold uppercase tracking-wider text-accent">
        {title}
      </h3>
      {children}
    </section>
  );
}

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const { facets, fromCatalog } = useWineFacets(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setDraft(initialFilters);
      setValidationError(null);
    }
  }, [open, initialFilters]);

  useEffect(() => {
    if (!open) return;

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (controls.length === 0) return;

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog?.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog?.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus();
      previousActiveElementRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  function update<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function changeCountry(country: string) {
    setDraft((prev) => {
      const regions = facets.countries.find((entry) => entry.name === country)?.regions ?? [];
      // Without a catalog region list we can't tell whether the region fits, so it's kept.
      const keepRegion = !country || !fromCatalog || regions.includes(prev.region);
      return { ...prev, country, region: keepRegion ? prev.region : "" };
    });
  }

  const typeValues = facets.types.includes(draft.type) || !draft.type ? facets.types : [...facets.types, draft.type];
  const countryNames = facets.countries.map((entry) => entry.name);
  if (draft.country && !countryNames.includes(draft.country)) countryNames.push(draft.country);
  const regionGroups = draft.country
    ? facets.countries.filter((entry) => entry.name === draft.country)
    : facets.countries.filter((entry) => entry.regions.length > 0);
  const knownRegions = regionGroups.flatMap((entry) => entry.regions);
  const years = yearOptions(
    facets.vintage.min ?? FALLBACK_FIRST_YEAR,
    facets.vintage.max ?? new Date().getFullYear(),
    [draft.vintageFrom, draft.vintageTo]
  );
  const activeCount = countActiveFilters(draft);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filters-title"
    >
      <div className="flex h-full w-full max-w-sm min-w-0 flex-col border-l border-surface-border bg-surface">
        <div className="flex items-center justify-between p-4 pb-3">
          <h2 id="filters-title" className="font-serif text-lg text-ink">
            Filters
          </h2>
          <button type="button" onClick={onClose} aria-label="Close filters" className="text-ink-muted">
            &times;
          </button>
        </div>

        <div data-testid="filter-drawer-body" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          <FilterGroup id="filters-find" title="Find">
            <div className={LABELLED}>
              <label htmlFor="filter-search">Search</label>
              <input id="filter-search" type="text" value={draft.q} onChange={(e) => update("q", e.target.value)} placeholder="Wine or winery name" className={FIELD} />
            </div>
            <div className={LABELLED}>
              <label htmlFor="filter-type">Type</label>
              <select id="filter-type" value={draft.type} onChange={(e) => update("type", e.target.value)} className={FIELD}>
                <option value="">All types</option>
                {typeValues.map((value) => (
                  <option key={value} value={value}>
                    {typeLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className={LABELLED}>
              <label htmlFor="filter-grape">Grape</label>
              <input id="filter-grape" type="text" value={draft.grape} onChange={(e) => update("grape", e.target.value)} placeholder="e.g. cabernet" className={FIELD} />
            </div>
          </FilterGroup>

          <FilterGroup id="filters-origin" title="Origin">
            <div className={LABELLED}>
              <label htmlFor="filter-country">Country</label>
              <select id="filter-country" value={draft.country} onChange={(e) => changeCountry(e.target.value)} className={FIELD}>
                <option value="">All countries</option>
                {countryNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className={LABELLED}>
              <label htmlFor="filter-region">Region</label>
              {fromCatalog ? (
                <select id="filter-region" value={draft.region} onChange={(e) => update("region", e.target.value)} className={FIELD}>
                  <option value="">All regions</option>
                  {draft.region && !knownRegions.includes(draft.region) ? <option value={draft.region}>{draft.region}</option> : null}
                  {draft.country
                    ? knownRegions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))
                    : regionGroups.map((entry) => (
                        <optgroup key={entry.name} label={entry.name}>
                          {entry.regions.map((region) => (
                            <option key={region} value={region}>
                              {region}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                </select>
              ) : (
                <input id="filter-region" type="text" value={draft.region} onChange={(e) => update("region", e.target.value)} placeholder="e.g. Bordeaux" className={FIELD} />
              )}
            </div>
          </FilterGroup>

          <FilterGroup id="filters-price" title="Price & alcohol">
            <div className="flex gap-2 min-w-0">
              <NumberStepperField id="filter-min-price" label="Min price" value={toNumber(draft.minPrice)} onChange={(value) => update("minPrice", fromNumber(value))} />
              <NumberStepperField id="filter-max-price" label="Max price" value={toNumber(draft.maxPrice)} onChange={(value) => update("maxPrice", fromNumber(value))} />
            </div>
            <div className="flex gap-2 min-w-0">
              <NumberStepperField id="filter-min-abv" label="Min alcohol" step={0.5} suffix="%" value={toNumber(draft.minAbv)} onChange={(value) => update("minAbv", fromNumber(value))} />
              <NumberStepperField id="filter-max-abv" label="Max alcohol" step={0.5} suffix="%" value={toNumber(draft.maxAbv)} onChange={(value) => update("maxAbv", fromNumber(value))} />
            </div>
          </FilterGroup>

          <FilterGroup id="filters-vintage" title="Vintage">
            <div className="flex gap-2 min-w-0">
              {(["vintageFrom", "vintageTo"] as const).map((key) => (
                <div key={key} className={`${LABELLED} min-w-0 flex-1`}>
                  <label htmlFor={`filter-${key}`}>{key === "vintageFrom" ? "Vintage from" : "Vintage to"}</label>
                  <select id={`filter-${key}`} value={draft[key]} onChange={(e) => update(key, e.target.value)} className={FIELD}>
                    <option value="">Any</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.excludeNv === ""}
                onChange={(e) => update("excludeNv", e.target.checked ? "" : "1")}
                className="accent-[var(--color-accent)]"
              />
              Include non-vintage (NV) wines
            </label>
          </FilterGroup>

          <FilterGroup id="filters-taste" title="Taste profile">
            {DIMENSIONS.map((dimension) => (
              <TasteRangeField key={dimension} dimension={dimension} value={draft[dimension]} onChange={(value) => update(dimension, value)} />
            ))}
          </FilterGroup>

          <FilterGroup id="filters-sort" title="Sort">
            <div className={LABELLED}>
              <label htmlFor="filter-sort">Sort by</label>
              <select id="filter-sort" value={draft.sort} onChange={(e) => update("sort", e.target.value as SortOption)} className={FIELD}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </FilterGroup>
        </div>

        <div className="flex flex-col gap-2 border-t border-surface-border p-4">
          {validationError ? <p role="alert" className="text-sm text-ink">{validationError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_FILTERS)}
              className="flex-1 border border-surface-border rounded py-2 text-sm text-ink-muted"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const error = validate(draft);
                setValidationError(error);
                if (!error) onApply({ ...draft, q: draft.q.trim(), grape: draft.grape.trim(), region: draft.region.trim() });
              }}
              className="flex-1 bg-accent text-surface rounded py-2 text-sm font-semibold"
            >
              {activeCount > 0 ? `Apply · ${activeCount} ${activeCount === 1 ? "filter" : "filters"}` : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
