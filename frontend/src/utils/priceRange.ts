export function priceRangeError(min?: number, max?: number): string | null {
  if ([min, max].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
    return "Prices must be zero or greater.";
  }
  return min !== undefined && max !== undefined && min > max
    ? "Minimum price must not exceed maximum price."
    : null;
}
