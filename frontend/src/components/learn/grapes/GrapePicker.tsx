import { useRef, type KeyboardEvent } from "react";
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

  // Each colour gets its own section, wrapping instead of scrolling, so the whites start below the reds.
  const groups: Array<{
    color: GrapeContent["color"];
    entries: Array<{ grape: GrapeContent; index: number }>;
  }> = [];
  grapes.forEach((grape, index) => {
    const group = groups[groups.length - 1];
    if (group?.color === grape.color) group.entries.push({ grape, index });
    else groups.push({ color: grape.color, entries: [{ grape, index }] });
  });

  return (
    <div role="tablist" aria-label="Grapes" className="flex flex-col gap-3 py-1">
      {groups.map((group) => (
        <div key={group.color} data-grape-group={group.color} className="flex items-start gap-3">
          <span aria-hidden="true" className="w-16 shrink-0 pt-2 text-xs uppercase tracking-[0.2em] text-ink-muted">
            {GROUP_LABEL[group.color]}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {group.entries.map(({ grape, index }) => {
              const selected = grape.id === selectedId;
              return (
                <button
                  key={grape.id}
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
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full border border-surface-border ${DOT_CLASS[grape.color]}`}
                  />
                  {grape.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
