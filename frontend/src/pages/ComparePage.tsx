import { useEffect, useRef, useState } from "react";
import { ApiError, getWine } from "../services/api";
import { useCompareSelection } from "../hooks/useCompareSelection";
import { WineSearchPicker } from "../components/compare/WineSearchPicker";
import { CompareSlot } from "../components/compare/CompareSlot";
import { CompareTable } from "../components/compare/CompareTable";
import { CompareRadarChart } from "../components/compare/CompareRadarChart";
import { Skeleton } from "../components/common/Skeleton";
import type { WineDetail } from "../types/wine";

const MAX_SLOTS = 4;

type SlotState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "loaded"; wine: WineDetail };

export function ComparePage() {
  const { selectedIds, addWine, removeWine } = useCompareSelection();
  const [wineStates, setWineStates] = useState<Record<number, SlotState>>({});
  const requestIdsRef = useRef<Record<number, number>>({});

  useEffect(() => {
    for (const id of selectedIds) {
      if (wineStates[id]) continue;
      const requestId = (requestIdsRef.current[id] ?? 0) + 1;
      requestIdsRef.current[id] = requestId;
      setWineStates((prev) => ({ ...prev, [id]: { status: "loading" } }));
      getWine(id)
        .then((wine) => {
          if (requestIdsRef.current[id] !== requestId) return;
          setWineStates((prev) => ({ ...prev, [id]: { status: "loaded", wine } }));
        })
        .catch((err) => {
          if (requestIdsRef.current[id] !== requestId) return;
          const message = err instanceof ApiError ? err.message : "Failed to load this wine";
          setWineStates((prev) => ({ ...prev, [id]: { status: "error", error: message } }));
        });
    }

    for (const idStr of Object.keys(wineStates)) {
      const id = Number(idStr);
      if (selectedIds.includes(id)) continue;
      requestIdsRef.current[id] = (requestIdsRef.current[id] ?? 0) + 1;
      setWineStates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const loadedWines = selectedIds
    .map((id) => wineStates[id])
    .filter((state): state is Extract<SlotState, { status: "loaded" }> => state?.status === "loaded")
    .map((state) => state.wine);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl text-ink">Compare</h1>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {selectedIds.map((id) => {
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
          return <CompareSlot key={id} wine={state.wine} onRemove={() => removeWine(id)} />;
        })}
        {selectedIds.length < MAX_SLOTS ? (
          <WineSearchPicker key={selectedIds.length} excludeIds={selectedIds} onSelect={addWine} />
        ) : null}
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

      {loadedWines.length < 2 ? (
        <p className="text-ink-muted text-center py-8">Add at least 2 wines to compare.</p>
      ) : (
        <>
          <CompareTable wines={loadedWines} />
          <CompareRadarChart wines={loadedWines} />
        </>
      )}
    </div>
  );
}
