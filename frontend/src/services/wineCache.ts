import { getWine } from "./api";
import type { WineDetail } from "../types/wine";

const TTL_MS = 60_000;
const MAX_ENTRIES = 100;
const entries = new Map<number, { wine: WineDetail; expires: number }>();
const requests = new Map<number, symbol>();

export function invalidateWineCache(id?: number) {
  if (id === undefined) {
    entries.clear();
    requests.clear();
  } else {
    entries.delete(id);
    requests.delete(id);
  }
}

export async function getCachedWine(id: number): Promise<WineDetail> {
  const cached = entries.get(id);
  if (cached && cached.expires > Date.now()) return cached.wine;
  entries.delete(id);
  const request = Symbol();
  requests.set(id, request);
  try {
    const wine = await getWine(id);
    // A newer request or an edit must not be overwritten by an older response.
    if (requests.get(id) === request) {
      entries.set(id, { wine, expires: Date.now() + TTL_MS });
      if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    }
    return wine;
  } finally {
    if (requests.get(id) === request) requests.delete(id);
  }
}
