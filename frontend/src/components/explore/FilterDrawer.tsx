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
