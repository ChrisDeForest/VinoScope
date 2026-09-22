import { useEffect, useRef, useState } from "react";
import type { SortOption } from "../../types/wine";
import { DEFAULT_FILTERS, type FilterValues } from "./filterTypes";

const TYPE_OPTIONS = ["", "red", "white", "rosé", "sparkling", "fortified"];
const TYPE_LABELS: Record<string, string> = {
  "": "All types",
  red: "Red",
  white: "White",
  rosé: "Rosé",
  sparkling: "Sparkling",
  fortified: "Fortified",
};

const COUNTRY_OPTIONS = [
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

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "winery", label: "Winery (A-Z)" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "vintage", label: "Vintage" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setDraft(initialFilters);
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
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

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

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filters-title"
    >
      <div className="w-full max-w-sm min-w-0 bg-surface border-l border-surface-border p-4 overflow-y-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="filters-title" className="font-serif text-lg text-ink">
            Filters
          </h2>
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
            className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <label htmlFor="filter-type">Type</label>
          <select
            id="filter-type"
            value={draft.type}
            onChange={(e) => update("type", e.target.value)}
            className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
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
            className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
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
            className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>

        <div className="flex gap-2 min-w-0">
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-ink-muted">
            <label htmlFor="filter-min-price">Min price</label>
            <input
              id="filter-min-price"
              type="number"
              min={0}
              value={draft.minPrice}
              onChange={(e) => update("minPrice", e.target.value)}
              className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-ink-muted">
            <label htmlFor="filter-max-price">Max price</label>
            <input
              id="filter-max-price"
              type="number"
              min={0}
              value={draft.maxPrice}
              onChange={(e) => update("maxPrice", e.target.value)}
              className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <label htmlFor="filter-sort">Sort by</label>
          <select
            id="filter-sort"
            value={draft.sort}
            onChange={(e) => update("sort", e.target.value as SortOption)}
            className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
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
