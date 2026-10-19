import type { Dimension } from "./dimensionLabels";

/** Short level names that fit five-across in the filter drawer and read well in chips. */
export const TASTE_LEVEL_SHORT: Record<Dimension, Record<number, string>> = {
  sweetness: { 1: "Very dry", 2: "Dry", 3: "Off-dry", 4: "Sweet", 5: "Very sweet" },
  acidity: { 1: "Low", 2: "Med-low", 3: "Medium", 4: "Med-high", 5: "High" },
  tannin: { 1: "Low", 2: "Med-low", 3: "Medium", 4: "Med-high", 5: "High" },
  body: { 1: "Very light", 2: "Light", 3: "Medium", 4: "Full", 5: "Very full" },
  fruitiness: { 1: "Subtle", 2: "Light", 3: "Moderate", 4: "Forward", 5: "Very forward" },
};

const RANGE_PATTERN = /^([1-5])(?:-([1-5]))?$/;

/** "2-4" → [2, 4]; "3" → [3, 3]; anything else (including "4-2") → null. */
export function parseTasteRange(value: string): [number, number] | null {
  const match = RANGE_PATTERN.exec(value);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  return low <= high ? [low, high] : null;
}

/** Order-insensitive, so taps can go either way; a one-level range is written as that level. */
export function formatTasteRange(a: number, b: number): string {
  const [low, high] = a <= b ? [a, b] : [b, a];
  return low === high ? String(low) : `${low}-${high}`;
}

export function describeTasteRange(dimension: Dimension, value: string): string {
  const range = parseTasteRange(value);
  if (!range) return value;
  const labels = TASTE_LEVEL_SHORT[dimension];
  return range[0] === range[1] ? labels[range[0]] : `${labels[range[0]]} – ${labels[range[1]]}`;
}
