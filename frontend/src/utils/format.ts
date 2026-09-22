export function formatPrice(price: number | null): string {
  if (price === null) return "Price unavailable";
  return `$${price.toFixed(2)}`;
}

export function formatVintage(vintage: number | null): string {
  return vintage === null ? "NV" : String(vintage);
}

export function primaryGrapeLabel(grapes: { name: string; percentage: number | null }[]): string {
  if (grapes.length === 0) return "Blend unknown";
  if (grapes.length === 1) return grapes[0].name;
  return "Blend";
}
