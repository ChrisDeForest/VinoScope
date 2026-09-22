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
