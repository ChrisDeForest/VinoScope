import { useSearchParams } from "react-router-dom";

const MAX_WINES = 4;
const PARAM_KEY = "wines";

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
    if (ids.length === MAX_WINES) break;
  }
  return ids;
}

export function useCompareSelection(): {
  selectedIds: number[];
  addWine: (id: number) => void;
  removeWine: (id: number) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIds = parseIds(searchParams.get(PARAM_KEY));

  function writeIds(ids: number[]) {
    const next = new URLSearchParams(searchParams);
    if (ids.length === 0) {
      next.delete(PARAM_KEY);
    } else {
      next.set(PARAM_KEY, ids.join(","));
    }
    setSearchParams(next, { replace: true });
  }

  function addWine(id: number) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_WINES) return;
    writeIds([...selectedIds, id]);
  }

  function removeWine(id: number) {
    writeIds(selectedIds.filter((existing) => existing !== id));
  }

  return { selectedIds, addWine, removeWine };
}
