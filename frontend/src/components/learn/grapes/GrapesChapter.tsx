import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_GRAPE_ID, GRAPES } from "../../../content/learn/grapes";
import { GrapePanel } from "./GrapePanel";
import { GrapePicker, grapeTabId } from "./GrapePicker";

const HASH_PREFIX = "#grape-";

export function grapeIdFromHash(hash: string): string {
  if (!hash.startsWith(HASH_PREFIX)) return DEFAULT_GRAPE_ID;
  const id = hash.slice(HASH_PREFIX.length);
  return GRAPES.some((grape) => grape.id === id) ? id : DEFAULT_GRAPE_ID;
}

export function GrapesChapter() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  // Read once on arrival; afterwards the selection drives the hash, not the other way round.
  const [selectedId, setSelectedId] = useState(() => grapeIdFromHash(hash));
  const grape = GRAPES.find((candidate) => candidate.id === selectedId) ?? GRAPES[0];

  function select(id: string) {
    setSelectedId(id);
    // Replace, so browsing grapes doesn't fill the back button; no scroll happens on a hash-only replace.
    navigate({ hash: `#${grapeTabId(id)}` }, { replace: true });
  }

  return (
    <div className="mt-8">
      <GrapePicker grapes={GRAPES} selectedId={selectedId} onSelect={select} />
      {/* Keyed so the panel remounts and its art redraws for each grape. */}
      <GrapePanel key={grape.id} grape={grape} />
    </div>
  );
}
