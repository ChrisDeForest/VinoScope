import type { ProfileValue } from "../../../content/learn/grapes";
import { DIMENSIONS, DIMENSION_LABELS, DIMENSION_TITLES, type Dimension } from "../../../utils/dimensionLabels";

const STEPS = [1, 2, 3, 4, 5] as const;

function describeValue(dimension: Dimension, value: ProfileValue): string {
  const title = DIMENSION_TITLES[dimension];
  const labels = DIMENSION_LABELS[dimension];
  if (typeof value === "number") return `${title}: ${labels[value]}, ${value} of 5`;
  return `${title}: ranges from ${labels[value[0]]} to ${labels[value[1]]}`;
}

function segmentState(value: ProfileValue, step: number): "filled" | "range" | "empty" {
  if (typeof value === "number") return step <= value ? "filled" : "empty";
  return step >= value[0] && step <= value[1] ? "range" : "empty";
}

// Ranges use a lighter fill; the accent token has no Tailwind opacity modifier, so opacity goes on the element.
const SEGMENT_CLASS = { filled: "bg-accent", range: "bg-accent opacity-50", empty: "bg-surface-border" } as const;

export function ProfileBars({ profile }: { profile: Record<Dimension, ProfileValue> }) {
  return (
    <ul aria-label="Taste profile" className="grid gap-2">
      {DIMENSIONS.map((dimension) => {
        const value = profile[dimension];
        return (
          <li key={dimension} className="grid grid-cols-[7rem_1fr] items-center gap-3">
            <span className="sr-only">{describeValue(dimension, value)}</span>
            <span aria-hidden="true" className="text-xs text-ink-muted">
              {DIMENSION_TITLES[dimension]}
            </span>
            <span aria-hidden="true" className="flex items-center gap-2">
              <span className="grid flex-1 grid-cols-5 gap-1">
              {STEPS.map((step) => {
                const state = segmentState(value, step);
                return (
                  <span key={step} data-testid="segment" data-state={state} className={`h-2 rounded-full ${SEGMENT_CLASS[state]}`} />
                );
              })}
              </span>
              {typeof value !== "number" ? <span className="text-[11px] text-ink-muted">varies</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
