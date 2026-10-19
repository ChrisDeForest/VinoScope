export function priceRangeError(min?: number, max?: number): string | null {
  if ([min, max].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
    return "Prices must be zero or greater.";
  }
  return min !== undefined && max !== undefined && min > max
    ? "Minimum price must not exceed maximum price."
    : null;
}

/** The same checks as `priceRangeError` for any non-negative range, worded for `noun` (e.g. "alcohol"). */
export function rangeError(min: number | undefined, max: number | undefined, noun: string): string | null {
  if ([min, max].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
    return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} must be zero or greater.`;
  }
  return min !== undefined && max !== undefined && min > max ? `Minimum ${noun} must not exceed maximum ${noun}.` : null;
}
