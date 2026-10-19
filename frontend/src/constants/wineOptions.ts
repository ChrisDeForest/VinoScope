import type { WineFacets } from "../types/wine";

export const TYPE_OPTIONS = ["", "red", "white", "rosé", "sparkling", "dessert", "fortified"];

export const TYPE_LABELS: Record<string, string> = {
  "": "All types",
  red: "Red",
  white: "White",
  rosé: "Rosé",
  sparkling: "Sparkling",
  dessert: "Dessert",
  fortified: "Fortified",
};

/** Label for a type value, including ones added to the catalog later. */
export function typeLabel(value: string): string {
  return TYPE_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export const COUNTRY_OPTIONS = [
  "",
  "Argentina",
  "Australia",
  "Canada",
  "Chile",
  "France",
  "Germany",
  "Hungary",
  "Italy",
  "New Zealand",
  "Portugal",
  "South Africa",
  "Spain",
  "United States",
];

/** Used when the facets request fails: no region list, so the region filter becomes free text. */
export const FALLBACK_FACETS: WineFacets = {
  types: TYPE_OPTIONS.filter(Boolean),
  countries: COUNTRY_OPTIONS.filter(Boolean).map((name) => ({ name, regions: [] })),
  vintage: { min: null, max: null },
  abv: { min: null, max: null },
};
