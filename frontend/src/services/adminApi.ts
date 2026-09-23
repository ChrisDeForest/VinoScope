import type {
  AdminStats,
  GrapeInput,
  ListingPayload,
  RetailerListing,
  WineDetail,
  WineUpdatePayload,
} from "../types/wine";
import { getAdminKey } from "./adminAuth";
import { ApiError } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function adminHeaders(): Record<string, string> {
  const key = getAdminKey();
  return key ? { "X-Admin-Key": key } : {};
}

export async function getAdminStats(): Promise<AdminStats> {
  const response = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: adminHeaders() });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load admin stats (${response.status})`);
  }
  return response.json();
}

export async function updateWine(id: number, payload: WineUpdatePayload): Promise<WineDetail> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to update wine (${response.status})`);
  }
  return response.json();
}

export async function updateGrapes(id: number, grapes: GrapeInput[]): Promise<WineDetail> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${id}/grapes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ grapes }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to update grapes (${response.status})`);
  }
  return response.json();
}

export async function createListing(wineId: number, payload: ListingPayload): Promise<RetailerListing> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to create listing (${response.status})`);
  }
  return response.json();
}

export async function updateListing(
  wineId: number,
  listingId: number,
  payload: ListingPayload
): Promise<RetailerListing> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}/listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to update listing (${response.status})`);
  }
  return response.json();
}

export async function deleteListing(wineId: number, listingId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}/listings/${listingId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to delete listing (${response.status})`);
  }
}
