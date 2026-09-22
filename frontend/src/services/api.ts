import type {
  ListWinesParams,
  RecommendationRequest,
  RecommendationResponse,
  WineDetail,
  WineListResponse,
} from "../types/wine";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function buildQueryString(params: ListWinesParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function listWines(params: ListWinesParams = {}): Promise<WineListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/wines${buildQueryString(params)}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load wines (${response.status})`);
  }
  return response.json();
}

export async function getWine(id: number): Promise<WineDetail> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${id}`);
  if (response.status === 404) {
    throw new ApiError(404, "Wine not found");
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load wine (${response.status})`);
  }
  return response.json();
}

export async function getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load recommendations (${response.status})`);
  }
  return response.json();
}
