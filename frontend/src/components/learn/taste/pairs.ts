import { listWines } from "../../../services/api";
import type { WinePick } from "../../../content/learn/taste";
import type { WineListItem } from "../../../types/wine";
import type { Dimension } from "../../../utils/dimensionLabels";

export type PairState =
  | { status: "loading" }
  | { status: "ready"; low: WineListItem; high: WineListItem }
  | { status: "hidden" };

// Name search can return near-misses (other vintages, similarly named wines), so only an exact match counts.
const SEARCH_LIMIT = 10;

export function matchPick(pick: WinePick, items: readonly WineListItem[]): WineListItem | undefined {
  return items.find((item) => item.winery === pick.winery && item.name === pick.name && item.vintage === pick.vintage);
}

async function findPick(pick: WinePick): Promise<WineListItem> {
  const { items } = await listWines({ q: pick.name, limit: SEARCH_LIMIT });
  const match = matchPick(pick, items);
  if (!match) throw new Error(`No exact match for ${pick.name}`);
  return match;
}

/** Resolves both picks. Never rejects: any miss, failure, or missing score hides the pair. */
export async function loadPair(dimension: Dimension, low: WinePick, high: WinePick): Promise<PairState> {
  const [lowResult, highResult] = await Promise.allSettled([findPick(low), findPick(high)]);
  if (lowResult.status !== "fulfilled" || highResult.status !== "fulfilled") return { status: "hidden" };
  if (lowResult.value[dimension] === null || highResult.value[dimension] === null) return { status: "hidden" };
  return { status: "ready", low: lowResult.value, high: highResult.value };
}
