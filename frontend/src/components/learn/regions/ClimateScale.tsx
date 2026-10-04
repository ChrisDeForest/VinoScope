import type { Climate } from "../../../content/learn/regions";

const STEPS = [1, 2, 3, 4, 5] as const;

export function ClimateScale({ value, label }: { value: Climate; label: string }) {
  return (
    <div className="mt-2">
      <p className="sr-only">
        Climate: {label}, {value} of 5 from cool to hot
      </p>
      <div aria-hidden="true" className="flex items-center gap-2 text-xs text-ink-muted">
        <span>Cool</span>
        <div className="flex flex-1 gap-1">
          {STEPS.map((step) => (
            <span
              key={step}
              data-step={step}
              data-active={step === value ? "" : undefined}
              className={`h-1.5 flex-1 rounded-full ${step === value ? "bg-accent" : "bg-surface-border"}`}
            />
          ))}
        </div>
        <span>Hot</span>
      </div>
      <p aria-hidden="true" className="mt-1 text-xs text-ink-muted">
        {label}
      </p>
    </div>
  );
}
