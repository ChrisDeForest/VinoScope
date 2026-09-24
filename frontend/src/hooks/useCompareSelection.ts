import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useMatch, useSearchParams } from "react-router-dom";

const MAX_WINES = 4;
const PARAM_KEY = "wines";
const STORAGE_KEY = "vinoscope.compare.wines";
const CHANGE_EVENT = "vinoscope:compare-change";
let memorySelection = "";

function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function readSavedIds(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return memorySelection; }
}

function saveIds(ids: number[]) {
  const next = ids.join(",");
  if (readSavedIds() === next) return;
  memorySelection = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the selection in memory when storage is unavailable. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part);
    if (!Number.isSafeInteger(n) || n <= 0 || seen.has(n)) continue;
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
  moveWine: (id: number, targetId: number) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const isComparePage = useMatch("/compare") !== null;
  const saved = useSyncExternalStore(subscribe, readSavedIds, () => "");
  const urlSelection = isComparePage ? searchParams.get(PARAM_KEY) : null;
  const raw = urlSelection ?? saved;
  const selectedIds = useMemo(() => parseIds(raw), [raw]);

  useEffect(() => {
    if (urlSelection !== null) saveIds(selectedIds);
  }, [urlSelection, selectedIds]);

  function writeIds(ids: number[]) {
    saveIds(ids);
    if (!isComparePage) return;
    const next = new URLSearchParams(searchParams);
    if (ids.length === 0) {
      next.delete(PARAM_KEY);
    } else {
      next.set(PARAM_KEY, ids.join(","));
    }
    setSearchParams(next, { replace: true });
  }

  function addWine(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0 || selectedIds.includes(id) || selectedIds.length >= MAX_WINES) return;
    writeIds([...selectedIds, id]);
  }

  function removeWine(id: number) {
    writeIds(selectedIds.filter((existing) => existing !== id));
  }

  function moveWine(id: number, targetId: number) {
    const from = selectedIds.indexOf(id);
    const to = selectedIds.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...selectedIds];
    next.splice(from, 1);
    next.splice(to, 0, id);
    writeIds(next);
  }

  return { selectedIds, addWine, removeWine, moveWine };
}
