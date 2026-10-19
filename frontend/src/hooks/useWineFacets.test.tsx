import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as api from "../services/api";
import { clearWineFacetsCache, useWineFacets } from "./useWineFacets";
import { FALLBACK_FACETS } from "../constants/wineOptions";
import type { WineFacets } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getWineFacets: vi.fn() };
});

const getWineFacetsMock = api.getWineFacets as unknown as ReturnType<typeof vi.fn>;
const FACETS: WineFacets = {
  types: ["red"],
  countries: [{ name: "Chile", regions: ["Maipo Valley"] }],
  vintage: { min: 2016, max: 2025 },
  abv: { min: 4, max: 20 },
};

describe("useWineFacets", () => {
  beforeEach(() => {
    clearWineFacetsCache();
    getWineFacetsMock.mockReset();
  });

  it("does not fetch until enabled", () => {
    const { result } = renderHook(() => useWineFacets(false));
    expect(getWineFacetsMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ facets: FALLBACK_FACETS, fromCatalog: false });
  });

  it("returns catalog facets and caches them for the session", async () => {
    getWineFacetsMock.mockResolvedValue(FACETS);
    const first = renderHook(() => useWineFacets(true));
    await waitFor(() => expect(first.result.current).toEqual({ facets: FACETS, fromCatalog: true }));
    const second = renderHook(() => useWineFacets(true));
    expect(second.result.current).toEqual({ facets: FACETS, fromCatalog: true });
    expect(getWineFacetsMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the fallback lists when the request fails", async () => {
    getWineFacetsMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useWineFacets(true));
    await waitFor(() => expect(getWineFacetsMock).toHaveBeenCalled());
    expect(result.current).toEqual({ facets: FALLBACK_FACETS, fromCatalog: false });
  });

  it("fallback lists include the catalog's missing type and countries", () => {
    expect(FALLBACK_FACETS.types).toContain("dessert");
    for (const country of ["Canada", "Hungary", "South Africa"]) {
      expect(FALLBACK_FACETS.countries.map((c) => c.name)).toContain(country);
    }
  });
});
