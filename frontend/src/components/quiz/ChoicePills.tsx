import type { ChoiceOption } from "./quizChoices";

const PILL =
  "inline-flex items-center gap-2 rounded-full border bg-surface px-4 py-2.5 text-base text-ink motion-safe:transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function CheckBox({ on, round = false }: { on: boolean; round?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-[18px] w-[18px] flex-none place-items-center border text-xs leading-none ${round ? "rounded-full" : "rounded"} ${
        on ? "border-accent bg-accent text-surface" : "border-ink-muted"
      }`}
    >
      {on ? "✓" : ""}
    </span>
  );
}

export function ChoicePills({
  legend,
  options,
  selected,
  onToggle,
  onClear,
  noneLabel,
}: {
  legend: string;
  options: ChoiceOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  noneLabel: string;
}) {
  const noneOn = selected.length === 0;
  return (
    <fieldset className="flex w-full max-w-2xl flex-col items-center gap-4">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap justify-center gap-2.5">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option.value)}
              className={`${PILL} ${on ? "border-accent ring-1 ring-accent" : "border-surface-border hover:border-accent motion-safe:hover:-translate-y-0.5"}`}
            >
              <CheckBox on={on} />
              {option.swatch ? (
                <span aria-hidden="true" className="h-3.5 w-3.5 flex-none rounded-full" style={{ background: option.swatch }} />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-pressed={noneOn}
        onClick={onClear}
        className={`${PILL} italic ${noneOn ? "border-accent" : "border-dashed border-surface-border text-ink-muted hover:border-accent"}`}
      >
        <CheckBox on={noneOn} round />
        {noneLabel}
      </button>
    </fieldset>
  );
}
