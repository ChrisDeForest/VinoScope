import { MAP_COUNTRIES } from "../../../content/learn/regions";

interface CountryChipsProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// A non-map way in: easy to tap (tiny countries included) and fully keyboard-friendly.
export function CountryChips({ selectedId, onSelect }: CountryChipsProps) {
  return (
    <div role="group" aria-label="Wine countries" className="flex items-center gap-2 overflow-x-auto py-1">
      {MAP_COUNTRIES.map((country) => {
        const pressed = country.id === selectedId;
        return (
          <button
            key={country.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(country.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              pressed ? "border-accent text-accent" : "border-surface-border text-ink-muted hover:text-ink"
            }`}
          >
            {country.name}
          </button>
        );
      })}
    </div>
  );
}
