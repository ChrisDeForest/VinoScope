import { useState } from "react";
import { DIMENSION_TITLES, type Dimension } from "../../utils/dimensionLabels";
import { TASTE_LEVEL_SHORT, formatTasteRange, parseTasteRange } from "../../utils/tasteRange";

const LEVELS = [1, 2, 3, 4, 5] as const;

export function TasteRangeField({ dimension, value, onChange }: {
  dimension: Dimension;
  value: string;
  onChange: (value: string) => void;
}) {
  // The first tap of a range. It only counts while the value is still that one level,
  // so a reset from outside (the drawer's Clear) can't leave a stale half-range behind.
  const [anchor, setAnchor] = useState<number | null>(null);
  const pending = anchor !== null && value === String(anchor) ? anchor : null;
  const range = parseTasteRange(value);
  const title = DIMENSION_TITLES[dimension];
  const titleId = `filter-taste-${dimension}`;

  function pick(level: number) {
    if (pending === null) {
      setAnchor(level);
      onChange(String(level));
    } else {
      setAnchor(null);
      onChange(formatTasteRange(pending, level));
    }
  }

  return (
    <div role="group" aria-labelledby={titleId} className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span id={titleId}>{title}</span>
        {value ? (
          <button
            type="button"
            onClick={() => {
              setAnchor(null);
              onChange("");
            }}
            aria-label={`Any ${title.toLowerCase()}`}
            className="text-xs text-accent hover:underline"
          >
            Any
          </button>
        ) : (
          <span className="text-xs">Any</span>
        )}
      </div>
      <div className="grid grid-cols-5 overflow-hidden rounded border border-surface-border">
        {LEVELS.map((level) => {
          const selected = range !== null && level >= range[0] && level <= range[1];
          return (
            <button
              key={level}
              type="button"
              aria-pressed={selected}
              onClick={() => pick(level)}
              className={`min-w-0 border-l border-surface-border px-1 py-1.5 text-[11px] leading-tight first:border-l-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                selected ? "bg-accent font-semibold text-surface" : "bg-surface-raised text-ink hover:bg-surface-border"
              }`}
            >
              {TASTE_LEVEL_SHORT[dimension][level]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
