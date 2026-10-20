import { useEffect, useState } from "react";
import { listWines } from "../../../services/api";

export type CountFilter = { country: string } | { region: string };

// Counts don't change while someone reads the page, so each filter is fetched once per session.
const cache = new Map<string, number>();

export function clearCatalogCountCache(): void {
  cache.clear();
}

function keyOf(filter: CountFilter): string {
  return "country" in filter ? `country:${filter.country}` : `region:${filter.region}`;
}

export function useCatalogCount(filter: CountFilter | null): number | null {
  const key = filter ? keyOf(filter) : null;
  const [loaded, setLoaded] = useState<{ key: string; count: number } | null>(null);

  useEffect(() => {
    if (!filter || !key || cache.has(key)) return;
    let active = true;
    listWines({ ...filter, limit: 1 })
      .then((response) => {
        cache.set(key, response.total);
        if (active) setLoaded({ key, count: response.total });
      })
      .catch(() => {
        // No count is fine; the link still works.
      });
    return () => {
      active = false;
    };
    // `key` captures everything about `filter` that matters; a new object with the same filter shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  return loaded?.key === key ? loaded.count : null;
}
