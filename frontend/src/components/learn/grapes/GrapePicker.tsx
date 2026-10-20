import { Fragment, useRef, type KeyboardEvent } from "react";
import type { GrapeContent } from "../../../content/learn/grapes";
import { GRAPE_PANEL_ID, grapeTabId } from "./grapeIds";

const DOT_CLASS = { red: "bg-wine-red", white: "bg-wine-white" } as const;
const GROUP_LABEL = { red: "Reds", white: "Whites" } as const;

interface GrapePickerProps {
  grapes: readonly GrapeContent[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function GrapePicker({ grapes, selectedId, onSelect }: GrapePickerProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // WAI-ARIA tabs with automatic activation: moving focus selects.
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = grapes.length - 1;
    const next: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    const target = next[event.key];
    onSelect(grapes[target].id);
    tabRefs.current[target]?.focus();
  }

  return (
    <div role="tablist" aria-label="Grapes" className="flex items-center gap-2 overflow-x-auto py-1">
      {grapes.map((grape, index) => {
        const selected = grape.id === selectedId;
        const startsGroup = index === 0 || grapes[index - 1].color !== grape.color;
        return (
          <Fragment key={grape.id}>
            {startsGroup ? (
              <span
                aria-hidden="true"
                className={`shrink-0 text-xs uppercase tracking-[0.2em] text-ink-muted ${index === 0 ? "" : "ml-4"}`}
              >
                {GROUP_LABEL[grape.color]}
              </span>
            ) : null}
            <button
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={grapeTabId(grape.id)}
              aria-selected={selected}
              aria-controls={selected ? GRAPE_PANEL_ID : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(grape.id)}
              onKeyDown={(event) => move(event, index)}
              className={`scroll-mt-24 shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                selected ? "border-accent text-accent" : "border-surface-border text-ink-muted hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full border border-surface-border ${DOT_CLASS[grape.color]}`} />
              {grape.name}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
