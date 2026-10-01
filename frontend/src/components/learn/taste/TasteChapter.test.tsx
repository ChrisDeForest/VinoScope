import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import { TASTE_DIMENSIONS } from "../../../content/learn/taste";
import type { WineListItem } from "../../../types/wine";
import { TasteChapter } from "./TasteChapter";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

// Every pick resolves to an exact match with a distinct id; the tannin high pick is missing.
const PICKS = TASTE_DIMENSIONS.flatMap((entry) => [
  { pick: entry.low, dimension: entry.dimension, score: 1 },
  { pick: entry.high, dimension: entry.dimension, score: 5 },
]);
const TANNIN_HIGH = TASTE_DIMENSIONS.find((entry) => entry.dimension === "tannin")!.high;

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
  vi.mocked(api.listWines).mockImplementation(async (params = {}) => {
    if (params.q === TANNIN_HIGH.name) return { total: 0, items: [] };
    const index = PICKS.findIndex(({ pick }) => pick.name === params.q);
    const { pick, dimension, score } = PICKS[index];
    const item: WineListItem = {
      id: 100 + index,
      name: pick.name,
      winery: pick.winery,
      vintage: pick.vintage,
      type: "white",
      country: "France",
      region: null,
      grapes: [],
      price: null,
      currency: null,
      price_usd_approx: null,
      image_url: null,
      sweetness: 3,
      acidity: 3,
      tannin: 3,
      body: 3,
      fruitiness: 3,
      [dimension]: score,
    };
    return { total: 1, items: [item] };
  });
});

function renderChapter() {
  render(
    <MemoryRouter>
      <TasteChapter />
    </MemoryRouter>
  );
}

describe("TasteChapter", () => {
  it("renders one block per dimension in order", () => {
    renderChapter();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Sweetness",
      "Acidity",
      "Tannin",
      "Body",
      "Fruit Intensity",
    ]);
  });

  it("loads each pair and hides only the pair whose pick has no match", async () => {
    renderChapter();
    expect(await screen.findAllByRole("list", { name: "Example wines" })).toHaveLength(4);
    const tannin = screen.getByRole("article", { name: "Tannin" });
    expect(tannin.querySelector('[aria-label="Example wines"]')).toBeNull();
    expect(tannin).toHaveTextContent(TASTE_DIMENSIONS.find((entry) => entry.dimension === "tannin")!.what);
  });
});
