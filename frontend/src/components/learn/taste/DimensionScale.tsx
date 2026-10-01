import { DIMENSION_LABELS, DIMENSION_TITLES, type Dimension } from "../../../utils/dimensionLabels";

export type PairTone = "low" | "high";

export interface ScaleMarker {
  score: number;
  name: string;
  tone: PairTone;
}

const STEPS = [1, 2, 3, 4, 5] as const;

export function DimensionScale({ dimension, markers }: { dimension: Dimension; markers: readonly ScaleMarker[] }) {
  return (
    <ol aria-label={`${DIMENSION_TITLES[dimension]} scale, 1 to 5`} className="grid grid-cols-5 gap-1 my-6">
      {STEPS.map((step) => {
        const here = markers.filter((marker) => marker.score === step);
        return (
          <li key={step} className="flex flex-col items-center text-center">
            <span className={`h-1.5 w-full rounded-full ${here.length > 0 ? "bg-accent" : "bg-surface-border"}`} />
            <span className="mt-2 text-sm text-ink">{step}</span>
            <span className="text-[11px] leading-tight text-ink-muted">{DIMENSION_LABELS[dimension][step]}</span>
            {here.map((marker) => (
              <span key={marker.name} className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                <span className="sr-only">Example: {marker.name}</span>
                <span aria-hidden="true">{marker.tone === "low" ? "Low" : "High"}</span>
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
