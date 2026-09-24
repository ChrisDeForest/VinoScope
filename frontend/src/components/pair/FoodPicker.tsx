import { FOOD_OPTIONS, FOOD_PAIRINGS, type FoodKey } from "../../constants/foodPairings";

export function FoodPicker({
  onSelect,
  loading = false,
}: {
  onSelect: (food: FoodKey) => void;
  loading?: boolean;
}) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
      {FOOD_OPTIONS.map((food) => {
        const { label, blurb } = FOOD_PAIRINGS[food];
        return (
          <button
            key={food}
            type="button"
            onClick={() => onSelect(food)}
            disabled={loading}
            className="text-left border border-surface-border rounded p-4 hover:border-accent disabled:opacity-50"
          >
            <span className="block font-serif text-base text-ink mb-1">{label}</span>
            <span className="block text-sm text-ink-muted">{blurb}</span>
          </button>
        );
      })}
    </div>
  );
}
