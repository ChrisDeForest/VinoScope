import { useEffect, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { DEFAULT_GRAPE_ID, GRAPES } from "../../../content/learn/grapes";
import { GrapePanel } from "./GrapePanel";
import { GrapePicker, grapeTabId } from "./GrapePicker";

const HASH_PREFIX = "#grape-";

function knownGrapeId(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const id = hash.slice(HASH_PREFIX.length);
  return GRAPES.some((grape) => grape.id === id) ? id : null;
}

export function grapeIdFromHash(hash: string): string {
  return knownGrapeId(hash) ?? DEFAULT_GRAPE_ID;
}

export function GrapesChapter() {
  const location = useLocation();
  const { hash } = location;
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  // Read on arrival; afterwards the selection drives the hash, except that Back/Forward to a grape hash drives the selection.
  const [selectedId, setSelectedId] = useState(() => grapeIdFromHash(hash));
  // Only the chapter's first grape waits for the scroll-in delay; later switches reveal at once.
  const [switched, setSwitched] = useState(false);
  const grape = GRAPES.find((candidate) => candidate.id === selectedId) ?? GRAPES[0];

  useEffect(() => {
    const id = navigationType === "POP" ? knownGrapeId(hash) : null;
    if (id) {
      setSelectedId(id);
      setSwitched(true);
    }
  }, [hash, navigationType]);

  function select(id: string) {
    setSelectedId(id);
    setSwitched(true);
    // Replace, so browsing grapes doesn't fill the back button; no scroll happens on a hash-only replace.
    navigate({ pathname: location.pathname, search: location.search, hash: `#${grapeTabId(id)}` }, { replace: true });
  }

  return (
    <div className="mt-8">
      <GrapePicker grapes={GRAPES} selectedId={selectedId} onSelect={select} />
      {/* Keyed so the panel remounts and its art redraws for each grape. */}
      <GrapePanel key={grape.id} grape={grape} initial={!switched} />
    </div>
  );
}
