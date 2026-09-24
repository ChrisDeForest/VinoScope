import type { ListWinesParams, SortOption } from "../../types/wine";

export interface FilterValues {
  q: string;
  type: string;
  country: string;
  grape: string;
  minPrice: string;
  maxPrice: string;
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
  grape: "",
  minPrice: "",
  maxPrice: "",
  sort: "winery",
};

export function countActiveFilters(filters: FilterValues): number {
  let count = 0;
  if (filters.q) count++;
  if (filters.type) count++;
  if (filters.country) count++;
  if (filters.grape) count++;
  if (filters.minPrice) count++;
  if (filters.maxPrice) count++;
  return count;
}

export function filtersToApiParams(filters: FilterValues, limit: number, offset: number): ListWinesParams {
  const params: ListWinesParams = { limit, offset, sort: filters.sort };
  if (filters.q) params.q = filters.q;
  if (filters.type) params.type = filters.type;
  if (filters.country) params.country = filters.country;
  if (filters.grape) params.grape = filters.grape;
  if (filters.minPrice !== "") params.min_price = Number(filters.minPrice);
  if (filters.maxPrice !== "") params.max_price = Number(filters.maxPrice);
  return params;
}

const SEARCH_PARAM_NAMES: Record<keyof FilterValues, string> = {
  q: "q",
  type: "type",
  country: "country",
  grape: "grape",
  minPrice: "min_price",
  maxPrice: "max_price",
  sort: "sort",
};

export const FILTER_PARAM_NAMES: string[] = Object.values(SEARCH_PARAM_NAMES);

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
  return {
    q: params.get("q") ?? DEFAULT_FILTERS.q,
    type: params.get("type") ?? DEFAULT_FILTERS.type,
    country: params.get("country") ?? DEFAULT_FILTERS.country,
    grape: params.get("grape") ?? DEFAULT_FILTERS.grape,
    minPrice: params.get("min_price") ?? DEFAULT_FILTERS.minPrice,
    maxPrice: params.get("max_price") ?? DEFAULT_FILTERS.maxPrice,
    sort: (params.get("sort") as SortOption | null) ?? DEFAULT_FILTERS.sort,
  };
}
