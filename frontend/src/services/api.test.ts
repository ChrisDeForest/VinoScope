import { describe, it, expect, vi, afterEach } from "vitest";
import { listWines, getWine, getRecommendations, ApiError } from "./api";

describe("api service", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("listWines builds a query string from provided params and returns parsed JSON", async () => {
    const mockResponse = { total: 1, items: [] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await listWines({ type: "red", q: "caymus", limit: 10 });

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/wines?");
    expect(calledUrl).toContain("type=red");
    expect(calledUrl).toContain("q=caymus");
    expect(calledUrl).toContain("limit=10");
    expect(result).toEqual(mockResponse);
  });

  it("listWines omits unset params from the query string", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total: 0, items: [] }),
    });

    await listWines({});

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl.endsWith("/api/wines")).toBe(true);
  });

  it("listWines throws ApiError on a non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(listWines()).rejects.toBeInstanceOf(ApiError);
  });

  it("getWine returns parsed JSON on success", async () => {
    const mockWine = { id: 1, name: "Test Wine" };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockWine });

    const result = await getWine(1);
    expect(result).toEqual(mockWine);
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/wines/1");
  });

  it("getWine throws a 404 ApiError when the wine is not found", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: "Wine not found" }) });

    await expect(getWine(999)).rejects.toMatchObject({ status: 404 });
  });
});

describe("getRecommendations", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts the request as JSON and returns parsed JSON", async () => {
    const mockResponse = { profile: { description: [] }, total: 0, items: [] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockResponse });

    const result = await getRecommendations({ type: "red", sweetness: 1 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/recommendations"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "red", sweetness: 1 }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws ApiError on a non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(getRecommendations({})).rejects.toBeInstanceOf(ApiError);
  });
});
