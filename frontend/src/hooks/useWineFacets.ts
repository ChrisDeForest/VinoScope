import { useEffect, useState } from "react";
import { getWineFacets } from "../services/api";
import { FALLBACK_FACETS } from "../constants/wineOptions";
import type { WineFacets } from "../types/wine";

// Filter options don't change while someone browses, so they're fetched once per session.
let cached: WineFacets | null = null;

export function clearWineFacetsCache(): void {
  cached = null;
}

export function useWineFacets(enabled: boolean): { facets: WineFacets; fromCatalog: boolean } {
  const [loaded, setLoaded] = useState<WineFacets | null>(cached);

  useEffect(() => {
    if (!enabled || cached) return;
    let active = true;
    getWineFacets()
      .then((facets) => {
        cached = facets;
        if (active) setLoaded(facets);
      })
      .catch(() => {
        // The fallback lists still let people filter.
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const facets = loaded ?? cached;
  return facets ? { facets, fromCatalog: true } : { facets: FALLBACK_FACETS, fromCatalog: false };
}
