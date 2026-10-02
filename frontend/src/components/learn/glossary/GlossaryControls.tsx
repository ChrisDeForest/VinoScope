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
