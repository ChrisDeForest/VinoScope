import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAdminStats,
  updateWine,
  updateGrapes,
  createListing,
  updateListing,
  deleteListing,
} from "./adminApi";
import { setAdminKey, clearAdminKey } from "./adminAuth";
import { ApiError } from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.clear();
  setAdminKey("test-key");
});

describe("adminApi", () => {
  it("getAdminStats sends the admin key header", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ wines_count: 0 }) });
    await getAdminStats();
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/admin/stats");
    expect((options.headers as Record<string, string>)["X-Admin-Key"]).toBe("test-key");
  });

  it("updateWine sends a PATCH with the payload", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    await updateWine(1, { abv: 14.5 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ abv: 14.5 });
  });

  it("updateGrapes sends a PUT to the grapes endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    await updateGrapes(1, [{ name: "Merlot", percentage: 100 }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/grapes");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body as string)).toEqual({ grapes: [{ name: "Merlot", percentage: 100 }] });
  });

  it("createListing sends a POST to the listings endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 5 }) });
    await createListing(1, { retailer: "Total Wine", price: 50 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/listings");
    expect(options.method).toBe("POST");
  });

  it("updateListing sends a PATCH to the specific listing", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 5 }) });
    await updateListing(1, 5, { price: 60 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/listings/5");
    expect(options.method).toBe("PATCH");
  });

  it("deleteListing sends a DELETE to the specific listing", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    await deleteListing(1, 5);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/listings/5");
    expect(options.method).toBe("DELETE");
  });

  it("throws ApiError on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(getAdminStats()).rejects.toBeInstanceOf(ApiError);
  });
});
