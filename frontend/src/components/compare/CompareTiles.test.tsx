import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompareTiles, type SlotState } from "./CompareTiles";
import type { WineDetail } from "../../types/wine";

function makeWine(id: number, overrides: Partial<WineDetail> = {}): WineDetail {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    subregion: null,
    grapes: [],
    price: 20,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: 2,
    acidity: 3,
    tannin: 4,
    body: 5,
    fruitiness: 1,
    abv: 13.5,
    description: null,
    listings: [],
    ...overrides,
  };
}

function mockColumnCount(matchesDesktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: matchesDesktop,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  );
}

function renderWines(count: number, moveWine: ReturnType<typeof vi.fn>) {
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const wineStates: Record<number, SlotState> = Object.fromEntries(
    ids.map((id) => [id, { status: "loaded" as const, wine: makeWine(id) }])
  );
  render(
    <CompareTiles
      selectedIds={ids}
      wineStates={wineStates}
      addWine={vi.fn()}
      removeWine={vi.fn()}
      moveWine={moveWine}
    />
  );
}

describe("CompareTiles keyboard reorder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("moves to the tile two slots away (next row) on ArrowDown in the 2-column mobile layout", async () => {
    mockColumnCount(false);
    const moveWine = vi.fn();
    renderWines(4, moveWine);

    screen.getByRole("button", { name: "Reorder Wine 1" }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(moveWine).toHaveBeenCalledWith(1, 3);
  });

  it("does not misfire a same-row move on ArrowDown in the 4-column desktop layout with only one row", async () => {
    mockColumnCount(true);
    const moveWine = vi.fn();
    renderWines(4, moveWine);

    screen.getByRole("button", { name: "Reorder Wine 1" }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(moveWine).not.toHaveBeenCalled();
  });

  it("still moves by one slot on ArrowLeft/ArrowRight regardless of column count", async () => {
    mockColumnCount(false);
    const moveWine = vi.fn();
    renderWines(4, moveWine);

    screen.getByRole("button", { name: "Reorder Wine 2" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(moveWine).toHaveBeenCalledWith(2, 3);
  });
});
