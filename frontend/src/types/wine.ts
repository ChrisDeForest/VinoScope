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
