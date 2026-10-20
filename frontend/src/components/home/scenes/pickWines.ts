import type { WineListItem } from "../../../types/wine";

export const SAMPLE_SIZE = 3;

/**
 * Picks one wine per color (in the given order), skipping colors with no
 * items. If fewer than SAMPLE_SIZE wines were picked, tops up from any
 * remaining items across all colors, never duplicating a wine by id.
 */
export function pickWines(
  responsesByColor: readonly WineListItem[][],
  random: () => number = Math.random
): WineListItem[] {
  const picked: WineListItem[] = [];
  const pickedIds = new Set<number>();
  const leftovers: WineListItem[] = [];

  for (const items of responsesByColor) {
    if (items.length === 0) continue;
    const index = Math.floor(random() * items.length);
    const chosen = items[index];
    if (!pickedIds.has(chosen.id)) {
      picked.push(chosen);
      pickedIds.add(chosen.id);
    }
    items.forEach((item, i) => {
      if (i !== index) leftovers.push(item);
    });
  }

  for (const item of leftovers) {
    if (picked.length >= SAMPLE_SIZE) break;
    if (!pickedIds.has(item.id)) {
      picked.push(item);
      pickedIds.add(item.id);
    }
  }

  return picked;
}
