import { FOOD_OPTIONS, FOOD_PAIRINGS, foodImage, type FoodKey } from "../../constants/foodPairings";

export function FoodCardGrid({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: FoodKey | null;
  onSelect: (food: FoodKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-4">
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {FOOD_OPTIONS.map((food) => {
          const on = food === selected;
          return (
            <button
              key={food}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onSelect(food)}
              className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-surface text-left motion-safe:transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
                on
                  ? "border-accent shadow-[0_0_0_3px_rgba(201,168,106,0.3)]"
                  : "border-transparent hover:border-surface-border motion-safe:hover:-translate-y-0.5"
              }`}
            >
              <img src={foodImage(food)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6 font-serif text-base text-white">
                {FOOD_PAIRINGS[food].label}
              </span>
              {on ? (
                <span aria-hidden="true" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-sm font-bold text-surface">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="min-h-[1.25rem] max-w-xl text-sm text-ink-muted">
        {selected ? FOOD_PAIRINGS[selected].blurb : ""}
      </p>
    </div>
  );
}
