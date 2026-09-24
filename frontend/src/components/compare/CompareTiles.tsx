import { useState } from "react";
import { WineSearchPicker } from "./WineSearchPicker";
import { CompareSlot } from "./CompareSlot";
import { Skeleton } from "../common/Skeleton";
import type { WineDetail } from "../../types/wine";

const MAX_SLOTS = 4;

// Matches the grid's own "md:grid-cols-4" breakpoint (Tailwind's default md = 768px) --
// keeps ArrowUp/ArrowDown moving to the tile actually above/below at the current layout
// instead of always shifting by one slot regardless of how many columns are on screen.
function currentColumnCount(): number {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? 4 : 2;
}

export type SlotState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "loaded"; wine: WineDetail };

export function CompareTiles({ selectedIds, wineStates, addWine, removeWine, moveWine }: {
  selectedIds: number[];
  wineStates: Record<number, SlotState>;
  addWine: (id: number) => void;
  removeWine: (id: number) => void;
  moveWine: (id: number, targetId: number) => void;
}) {
  const [drag, setDrag] = useState<{ id: number; target: number } | null>(null);
  const previewIds = [...selectedIds];
  if (drag && previewIds.includes(drag.id) && previewIds.includes(drag.target)) {
    const targetIndex = previewIds.indexOf(drag.target);
    previewIds.splice(previewIds.indexOf(drag.id), 1);
    previewIds.splice(targetIndex, 0, drag.id);
  }
  return (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {previewIds.map((id) => {
          const state = wineStates[id];
          if (!state || state.status === "loading") {
            return <Skeleton key={id} className="w-full h-48" />;
          }
          if (state.status === "error") {
            return (
              <div key={id} className="border border-surface-border rounded p-3 flex flex-col gap-2">
                <p className="text-sm text-ink-muted">{state.error}</p>
                <button type="button" onClick={() => removeWine(id)} className="text-sm text-accent hover:underline">
                  Remove
                </button>
              </div>
            );
          }
          return (
            <div key={id}
              className={`min-w-0 rounded transition-opacity ${drag?.id === id ? "opacity-50 ring-2 ring-accent" : ""}`}
              onDragOver={(event) => {
                if (!drag) return;
                event.preventDefault();
                if (id !== drag.id && id !== drag.target) setDrag({ ...drag, target: id });
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (drag) moveWine(drag.id, drag.target);
                setDrag(null);
              }}
            >
              <button type="button" draggable
                aria-label={`Reorder ${state.wine.name}`}
                className="w-full cursor-grab active:cursor-grabbing rounded-t border border-surface-border bg-surface-raised px-3 py-2 text-sm text-ink-muted focus-visible:outline focus-visible:outline-accent"
                onDragStart={(event) => {
                  if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(id));
                    event.dataTransfer.setDragImage(event.currentTarget.parentElement!, 30, 20);
                  }
                  setDrag({ id, target: id });
                }}
                onDragEnd={() => setDrag(null)}
                onKeyDown={(event) => {
                  const columns = currentColumnCount();
                  const offset =
                    event.key === "ArrowLeft" ? -1
                    : event.key === "ArrowRight" ? 1
                    : event.key === "ArrowUp" ? -columns
                    : event.key === "ArrowDown" ? columns
                    : 0;
                  if (!offset) return;
                  event.preventDefault();
                  const target = selectedIds[selectedIds.indexOf(id) + offset];
                  if (target !== undefined) moveWine(id, target);
                }}
              ><span aria-hidden="true">⠿</span> Move wine</button>
              <CompareSlot wine={state.wine} onRemove={() => removeWine(id)} />
            </div>
          );
        })}
        <div key="search" hidden={selectedIds.length >= MAX_SLOTS}>
          <WineSearchPicker excludeIds={selectedIds} onSelect={addWine} />
        </div>
        {Array.from({
          length: Math.max(0, MAX_SLOTS - selectedIds.length - (selectedIds.length < MAX_SLOTS ? 1 : 0)),
        }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="border border-dashed border-surface-border rounded p-3 opacity-50 flex items-center justify-center text-sm text-ink-muted h-48"
          >
            Empty slot
          </div>
        ))}
      </div>
  );
}
