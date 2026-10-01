import { describe, it, expect, vi, beforeEach } from "vitest";
import * as api from "../../../services/api";
import type { WineListItem } from "../../../types/wine";
import { loadPair, matchPick } from "./pairs";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

function wine(overrides: Partial<WineListItem>): WineListItem {
  return {
    id: 1,
    name: "Test Wine",
    winery: "Test Winery",
    vintage: 2022,
    type: "red",
    country: "France",
    region: null,
    grapes: [],
    price: null,
    currency: null,
    price_usd_approx: null,
    image_url: null,
    sweetness: 1,
    acidity: 3,
    tannin: 2,
    body: 3,
    fruitiness: 3,
    ...overrides,
  };
}

const LOW = { winery: "Louis Jadot", name: "Louis Jadot Bourgogne Pinot Noir", vintage: 2022, reason: "Silky." };
const HIGH = { winery: "Vietti", name: "Vietti Barolo Castiglione", vintage: 2020, reason: "Grippy." };

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
});

describe("matchPick", () => {
  it("requires an exact winery, name and vintage match", () => {
    const exact = wine({ id: 7, winery: "Vietti", name: "Vietti Barolo Castiglione", vintage: 2020 });
    const otherVintage = wine({ id: 8, winery: "Vietti", name: "Vietti Barolo Castiglione", vintage: 2019 });
    const otherWinery = wine({ id: 9, winery: "Not Vietti", name: "Vietti Barolo Castiglione", vintage: 2020 });
    expect(matchPick(HIGH, [otherVintage, otherWinery, exact])).toBe(exact);
    expect(matchPick(HIGH, [otherVintage, otherWinery])).toBeUndefined();
  });

  it("matches non-vintage picks against null vintages", () => {
    const nv = wine({ winery: "Castello del Poggio", name: "Castello del Poggio Moscato", vintage: null });
    expect(matchPick({ winery: "Castello del Poggio", name: "Castello del Poggio Moscato", vintage: null, reason: "" }, [nv])).toBe(nv);
  });
});

describe("loadPair", () => {
  it("searches by name and returns both matched wines", async () => {
    const low = wine({ id: 1, winery: LOW.winery, name: LOW.name, vintage: 2022, tannin: 2 });
    const high = wine({ id: 2, winery: HIGH.winery, name: HIGH.name, vintage: 2020, tannin: 5 });
    vi.mocked(api.listWines).mockImplementation(async (params = {}) => ({
      total: 1,
      items: params.q === LOW.name ? [low] : [high],
    }));
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "ready", low, high });
    expect(api.listWines).toHaveBeenCalledWith({ q: LOW.name, limit: 10 });
    expect(api.listWines).toHaveBeenCalledWith({ q: HIGH.name, limit: 10 });
  });

  it("hides the pair when one pick has no exact match", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "hidden" });
  });

  it("hides the pair when a request fails", async () => {
    const low = wine({ winery: LOW.winery, name: LOW.name, vintage: 2022 });
    vi.mocked(api.listWines).mockImplementation(async (params = {}) => {
      if (params.q === HIGH.name) throw new Error("network");
      return { total: 1, items: [low] };
    });
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "hidden" });
  });

  it("hides the pair when a wine has no score for the dimension", async () => {
    const low = wine({ winery: LOW.winery, name: LOW.name, vintage: 2022, tannin: null });
    const high = wine({ winery: HIGH.winery, name: HIGH.name, vintage: 2020, tannin: 5 });
    vi.mocked(api.listWines).mockImplementation(async (params = {}) => ({
      total: 1,
      items: params.q === LOW.name ? [low] : [high],
    }));
    await expect(loadPair("tannin", LOW, HIGH)).resolves.toEqual({ status: "hidden" });
  });
});
