import type { ListWinesParams, SortOption } from "../../types/wine";
import { DIMENSIONS, type Dimension } from "../../utils/dimensionLabels";
import { parseTasteRange } from "../../utils/tasteRange";

/** Every filter is a string ("" = off) so the URL, chip and count code can treat them alike. */
export interface FilterValues extends Record<Dimension, string> {
  q: string;
  type: string;
  country: string;
  region: string;
  grape: string;
  minPrice: string;
  maxPrice: string;
  minAbv: string;
  maxAbv: string;
  vintageFrom: string;
  vintageTo: string;
  /** "1" hides non-vintage wines; "" keeps them. */
  excludeNv: string;
  sort: SortOption;
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "winery", label: "Winery (A-Z)" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "vintage", label: "Vintage" },
];

export const DEFAULT_FILTERS: FilterValues = {
  q: "",
  type: "",
  country: "",
  region: "",
  grape: "",
  minPrice: "",
  maxPrice: "",
  minAbv: "",
  maxAbv: "",
  vintageFrom: "",
  vintageTo: "",
  excludeNv: "",
  sweetness: "",
  acidity: "",
  tannin: "",
  body: "",
  fruitiness: "",
  sort: "winery",
};

export function countActiveFilters(filters: FilterValues): number {
  return (Object.keys(DEFAULT_FILTERS) as (keyof FilterValues)[]).filter(
    (key) => key !== "sort" && filters[key] !== DEFAULT_FILTERS[key]
  ).length;
}

export function filtersToApiParams(filters: FilterValues, limit: number, offset: number): ListWinesParams {
  const params: ListWinesParams = { limit, offset, sort: filters.sort };
  if (filters.q) params.q = filters.q;
  if (filters.type) params.type = filters.type;
  if (filters.country) params.country = filters.country;
  if (filters.region) params.region = filters.region;
  if (filters.grape) params.grape = filters.grape;
  if (filters.minPrice !== "") params.min_price = Number(filters.minPrice);
  if (filters.maxPrice !== "") params.max_price = Number(filters.maxPrice);
  if (filters.minAbv !== "") params.min_abv = Number(filters.minAbv);
  if (filters.maxAbv !== "") params.max_abv = Number(filters.maxAbv);
  if (filters.vintageFrom !== "") params.vintage_from = Number(filters.vintageFrom);
  if (filters.vintageTo !== "") params.vintage_to = Number(filters.vintageTo);
  if (filters.excludeNv) params.include_nv = false;
  for (const dimension of DIMENSIONS) {
    const range = parseTasteRange(filters[dimension]);
    if (range) {
      params[`min_${dimension}` as const] = range[0];
      params[`max_${dimension}` as const] = range[1];
    }
  }
  return params;
}

const SEARCH_PARAM_NAMES: Record<keyof FilterValues, string> = {
  q: "q",
  type: "type",
  country: "country",
  region: "region",
  grape: "grape",
  minPrice: "min_price",
  maxPrice: "max_price",
  minAbv: "min_abv",
  maxAbv: "max_abv",
  vintageFrom: "vintage_from",
  vintageTo: "vintage_to",
  excludeNv: "exclude_nv",
  sweetness: "sweetness",
  acidity: "acidity",
  tannin: "tannin",
  body: "body",
  fruitiness: "fruitiness",
  sort: "sort",
};

export const FILTER_PARAM_NAMES: string[] = Object.values(SEARCH_PARAM_NAMES);

const NUMERIC_KEYS = ["minPrice", "maxPrice", "minAbv", "maxAbv", "vintageFrom", "vintageTo"] as const;

// The URL is the shareable, back/forward-friendly home for the applied filters --
// only non-default values are written so a plain "/explore" stays the canonical URL.
export function filtersToSearchParams(filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(SEARCH_PARAM_NAMES) as (keyof FilterValues)[]).forEach((key) => {
    const value = filters[key];
    if (value && value !== DEFAULT_FILTERS[key]) params.set(SEARCH_PARAM_NAMES[key], value);
  });
  return params;
}

export function filtersFromSearchParams(params: URLSearchParams): FilterValues {
  const filters: FilterValues = { ...DEFAULT_FILTERS };
  (Object.keys(SEARCH_PARAM_NAMES) as (keyof FilterValues)[]).forEach((key) => {
    const value = params.get(SEARCH_PARAM_NAMES[key]);
    if (value !== null) (filters as unknown as Record<string, string>)[key] = value;
  });
  // Hand-edited or stale links can carry junk the API would reject; drop it instead of erroring.
  for (const key of NUMERIC_KEYS) {
    if (filters[key] !== "" && !Number.isFinite(Number(filters[key]))) filters[key] = "";
  }
  for (const dimension of DIMENSIONS) {
    if (filters[dimension] && !parseTasteRange(filters[dimension])) filters[dimension] = "";
  }
  if (filters.excludeNv !== "1") filters.excludeNv = "";
  return filters;
}
