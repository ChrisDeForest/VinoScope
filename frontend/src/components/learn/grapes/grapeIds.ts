import { DEFAULT_GRAPE_ID, GRAPES } from "../../../content/learn/grapes";

export const GRAPE_PANEL_ID = "grape-panel";

export function grapeTabId(id: string): string {
  return `grape-${id}`;
}

const HASH_PREFIX = "#grape-";

export function knownGrapeId(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const id = hash.slice(HASH_PREFIX.length);
  return GRAPES.some((grape) => grape.id === id) ? id : null;
}

export function grapeIdFromHash(hash: string): string {
  return knownGrapeId(hash) ?? DEFAULT_GRAPE_ID;
}
