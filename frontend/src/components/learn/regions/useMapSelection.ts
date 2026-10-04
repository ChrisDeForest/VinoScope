import { useEffect, useRef, useState } from "react";
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
  // How many times Back/Forward has landed on a map hash: the chapter reopens the drawer on each.
  const [popCount, setPopCount] = useState(0);

  // Back/Forward to a map hash drives the map; other hashes (grapes, glossary, chapters) leave it alone.
  // The arrival itself (also a POP) is already the initial selection.
  const arrived = useRef(false);
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true;
      return;
    }
    if (navigationType !== "POP") return;
    const next = selectionFromHash(location.hash);
    if (!next) return;
    setSelection(next);
    setPopCount((count) => count + 1);
  }, [location.key, location.hash, navigationType]);

  function go(next: MapSelection) {
    setSelection(next);
    // Replace, like the grape picker, so exploring the map doesn't fill the back button.
    navigate({ pathname: location.pathname, search: location.search, hash: hashFor(next) }, { replace: true });
  }

  return {
    selection,
    popCount,
    selectCountry: (id: string) => go({ countryId: id, regionId: null }),
    selectRegion: (id: string) => {
      const region = regionById(id);
      if (region) go({ countryId: region.countryId, regionId: region.id });
    },
    showWorld: () => go(WORLD),
    stepBack: () => go(selection.regionId ? { countryId: selection.countryId, regionId: null } : WORLD),
  };
}
