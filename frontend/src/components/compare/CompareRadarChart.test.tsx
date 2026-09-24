import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompareRadarChart } from "./CompareRadarChart";
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

describe("CompareRadarChart", () => {
  it("renders a legend entry for each wine", () => {
    render(<CompareRadarChart wines={[makeWine(1), makeWine(2, { name: "Wine 2" })]} />);
    expect(screen.getByText("Wine 1")).toBeInTheDocument();
    expect(screen.getByText("Wine 2")).toBeInTheDocument();
  });

  it("does not show the missing-value caption when every wine has all five characteristics", () => {
    render(<CompareRadarChart wines={[makeWine(1), makeWine(2)]} />);
    expect(screen.queryByText(/plotted as 0/i)).not.toBeInTheDocument();
  });

  it("shows the missing-value caption when a wine is missing a characteristic", () => {
    render(<CompareRadarChart wines={[makeWine(1, { tannin: null }), makeWine(2)]} />);
    expect(screen.getByText(/plotted as 0/i)).toBeInTheDocument();
  });
});
