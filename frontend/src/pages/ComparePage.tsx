import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ApiError } from "../services/api";
import { getCachedWine } from "../services/wineCache";
import { useCompareSelection } from "../hooks/useCompareSelection";
import { CompareTable } from "../components/compare/CompareTable";
import { CompareTiles, type SlotState } from "../components/compare/CompareTiles";
import { Skeleton } from "../components/common/Skeleton";

const CompareRadarChart = lazy(() => import("../components/compare/CompareRadarChart").then((module) => ({ default: module.CompareRadarChart })));

export function ComparePage() {
  const { selectedIds, addWine, removeWine, moveWine } = useCompareSelection();
  const [wineStates, setWineStates] = useState<Record<number, SlotState>>({});
  const requestIdsRef = useRef<Record<number, number>>({});

  useEffect(() => {
    for (const id of selectedIds) {
      if (wineStates[id]) continue;
      const requestId = (requestIdsRef.current[id] ?? 0) + 1;
      requestIdsRef.current[id] = requestId;
      setWineStates((prev) => ({ ...prev, [id]: { status: "loading" } }));
      getCachedWine(id)
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
      <p className="text-sm text-ink-muted">Your wines are saved as you browse. Drag a tile by its handle to reorder, or focus the handle and use the arrow keys.</p>

      <CompareTiles selectedIds={selectedIds} wineStates={wineStates} addWine={addWine} removeWine={removeWine} moveWine={moveWine} />

      {loadedWines.length < 2 ? (
        <p className="text-ink-muted text-center py-8">Add at least 2 wines to compare.</p>
      ) : (
        <>
          <CompareTable wines={loadedWines} />
          <Suspense fallback={<Skeleton className="w-full h-[480px]" />}><CompareRadarChart wines={loadedWines} /></Suspense>
        </>
      )}
    </div>
  );
}
