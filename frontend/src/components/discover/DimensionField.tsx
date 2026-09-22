import { DIMENSION_LABELS, DIMENSION_TITLES, type Dimension } from "../../utils/dimensionLabels";

const LEVELS = [1, 2, 3, 4, 5] as const;

export function DimensionField({
  dimension,
  value,
  onChange,
}: {
  dimension: Dimension;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const labels = DIMENSION_LABELS[dimension];
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm text-ink-muted mb-1">{DIMENSION_TITLES[dimension]}</legend>
      <div className="flex flex-col gap-1">
        {LEVELS.map((level) => (
          <label key={level} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name={dimension} checked={value === level} onChange={() => onChange(level)} />
            {labels[level]}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="radio"
            name={dimension}
            checked={value === undefined}
            onChange={() => onChange(undefined)}
          />
          I'm unsure
        </label>
      </div>
    </fieldset>
  );
}
