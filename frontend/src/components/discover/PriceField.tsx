import { useRef } from "react";

export function PriceField({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  function step(direction: number) {
    if (!input.current) return;
    if (direction > 0) input.current.stepUp();
    else input.current.stepDown();
    onChange(input.current.value === "" ? undefined : input.current.valueAsNumber);
  }
  const buttonClass = "flex flex-1 items-center justify-center px-3 text-accent hover:bg-surface-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <label htmlFor={id} className="text-sm text-ink-muted">{label}</label>
      <div className="flex overflow-hidden bg-surface-raised border border-surface-border rounded focus-within:border-accent">
        <input
          ref={input}
          id={id}
          type="number"
          min={0}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="discover-price min-w-0 w-full bg-transparent px-2 py-1 text-ink focus:outline-none"
        />
        <div className="flex flex-col border-l border-surface-border">
          <button type="button" aria-label={`Increase ${label.toLowerCase()}`} className={buttonClass} onClick={() => step(1)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m3 8 3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          </button>
          <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} className={buttonClass} onClick={() => step(-1)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m3 4 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
