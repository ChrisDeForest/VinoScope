export interface Grape {
  name: string;
  percentage: number | null;
}

export interface WineListItem {
  id: number;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  country: string | null;
  region: string | null;
  grapes: Grape[];
  price: number | null;
  currency: string | null;
  price_usd_approx: number | null;
  image_url: string | null;
  sweetness: number | null;
  acidity: number | null;
  tannin: number | null;
  body: number | null;
  fruitiness: number | null;
}

export interface WineListResponse {
  total: number;
  items: WineListItem[];
}

export interface RetailerListing {
  id: number;
  retailer: string;
  price: number | null;
  currency: string | null;
  price_usd_approx: number | null;
  product_url: string | null;
  availability: string | null;
}

export interface WineDetail extends WineListItem {
  subregion: string | null;
  abv: number | null;
  description: string | null;
  listings: RetailerListing[];
}

export type SortOption = "price_asc" | "price_desc" | "vintage" | "winery";

export interface ListWinesParams {
  q?: string;
  type?: string;
  country?: string;
  grape?: string;
  min_price?: number;
  max_price?: number;
  sort?: SortOption;
  limit?: number;
  offset?: number;
}

export interface RecommendationAnswers {
  sweetness?: number | number[];
  acidity?: number | number[];
  tannin?: number | number[];
  body?: number | number[];
  fruitiness?: number | number[];
  type?: string;
  country?: string;
  min_price?: number;
  max_price?: number;
}

export interface RecommendationRequest extends RecommendationAnswers {
  limit?: number;
  offset?: number;
}

export interface RecommendationItem extends WineListItem {
  match_score: number;
  explanation: string[];
}

export interface RecommendationResponse {
  profile: { description: string[] };
  total: number;
  items: RecommendationItem[];
}

export interface ColumnStats {
  count: number;
  null_count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
}

export interface AdminStats {
  wines_count: number;
  wineries_count: number;
  retailers_count: number;
  listings_count: number;
  numeric: Record<string, ColumnStats>;
  categorical: Record<string, Record<string, number>>;
}

export interface WineUpdatePayload {
  name?: string;
  winery?: string;
  vintage?: number | null;
  type?: string;
  country?: string | null;
  region?: string | null;
  subregion?: string | null;
  abv?: number | null;
  sweetness?: number | null;
  acidity?: number | null;
  tannin?: number | null;
  body?: number | null;
  fruitiness?: number | null;
  description?: string | null;
  image_url?: string | null;
}

export interface ListingCreatePayload {
  retailer: string;
  price?: number | null;
  currency?: string | null;
  availability?: string | null;
  product_url?: string | null;
}

export interface ListingUpdatePayload {
  price?: number | null;
  currency?: string | null;
  availability?: string | null;
  product_url?: string | null;
}

export interface GrapeInput {
  name: string;
  percentage: number | null;
}
