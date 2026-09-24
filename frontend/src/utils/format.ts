import type { Grape } from "../types/wine";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  CHF: "CHF ",
  JPY: "¥",
  ZAR: "R",
  HUF: "Ft ",
  NZD: "NZ$",
};

export function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return "Price unavailable";
  const symbol = currency ? CURRENCY_SYMBOLS[currency] : undefined;
  if (symbol !== undefined) return `${symbol}${price.toFixed(2)}`;
  if (currency) return `${currency} ${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

export function formatApproxUsd(priceUsdApprox: number | null): string {
  return priceUsdApprox === null ? "" : `≈ $${priceUsdApprox.toFixed(2)} USD`;
}

export function hasApproxUsdConversion(currency: string | null, priceUsdApprox: number | null): boolean {
  return currency !== null && currency !== "USD" && currency in CURRENCY_SYMBOLS && priceUsdApprox !== null;
}

export function formatVintage(vintage: number | null): string {
  return vintage === null ? "NV" : String(vintage);
}

export function primaryGrapeLabel(grapes: { name: string; percentage: number | null }[]): string {
  if (grapes.length === 0) return "Blend unknown";
  if (grapes.length === 1) return grapes[0].name;
  return "Blend";
}

export function formatGrapeBreakdown(grapes: Grape[]): string {
  if (grapes.length === 0) return "Not specified";
  return grapes.map((g) => (g.percentage === null ? g.name : `${g.name} (${g.percentage}%)`)).join(", ");
}
