import { useEffect, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { countryById, regionById } from "../../../content/learn/regions";

export interface MapSelection {
  countryId: string | null;
  regionId: string | null;
}

export const WORLD: MapSelection = { countryId: null, regionId: null };

export function selectionFromHash(hash: string): MapSelection | null {
  const country = /^#country-(.+)$/.exec(hash);
  if (country && countryById(country[1])) return { countryId: country[1], regionId: null };
  const region = /^#region-(.+)$/.exec(hash);
  const match = region ? regionById(region[1]) : undefined;
  return match ? { countryId: match.countryId, regionId: match.id } : null;
}

export function hashFor({ countryId, regionId }: MapSelection): string {
  if (regionId) return `#region-${regionId}`;
  if (countryId) return `#country-${countryId}`;
  return "#regions";
}

export function useMapSelection() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [selection, setSelection] = useState<MapSelection>(() => selectionFromHash(location.hash) ?? WORLD);

  // Back/Forward to a map hash drives the map; other hashes (grapes, glossary, chapters) leave it alone.
  useEffect(() => {
    if (navigationType !== "POP") return;
    const next = selectionFromHash(location.hash);
    if (next) setSelection(next);
  }, [location.hash, navigationType]);

  function go(next: MapSelection) {
    setSelection(next);
    // Replace, like the grape picker, so exploring the map doesn't fill the back button.
    navigate({ pathname: location.pathname, search: location.search, hash: hashFor(next) }, { replace: true });
  }

  return {
    selection,
    selectCountry: (id: string) => go({ countryId: id, regionId: null }),
    selectRegion: (id: string) => {
      const region = regionById(id);
      if (region) go({ countryId: region.countryId, regionId: region.id });
    },
    showWorld: () => go(WORLD),
    stepBack: () => go(selection.regionId ? { countryId: selection.countryId, regionId: null } : WORLD),
  };
}
