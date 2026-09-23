import { DIMENSION_LABELS, DIMENSION_TITLES, type Dimension } from "../../utils/dimensionLabels";

const LEVELS = [1, 2, 3, 4, 5] as const;

export function DimensionField({
  dimension,
  value,
  onChange,
}: {
  dimension: Dimension;
  value: number | number[] | undefined;
  onChange: (value: number | number[] | undefined) => void;
}) {
  const selected = typeof value === "number" ? [value] : value ?? [];
  const labels = DIMENSION_LABELS[dimension];
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm text-ink-muted mb-1">{DIMENSION_TITLES[dimension]}</legend>
      <p className="text-xs text-ink-muted">Select all that you enjoy.</p>
      <div className="flex flex-col gap-1">
        {LEVELS.map((level) => (
          <label key={level} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="accent-accent"
              checked={selected.includes(level)}
              onChange={() => {
                const next = selected.includes(level)
                  ? selected.filter((item) => item !== level)
                  : [...selected, level].sort((a, b) => a - b);
                onChange(next.length ? next : undefined);
              }}
            />
            {labels[level]}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            className="accent-accent"
            name={dimension}
            checked={selected.length === 0}
            onChange={() => onChange(undefined)}
          />
          I'm unsure
        </label>
      </div>
    </fieldset>
  );
}
