import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompareTable } from "./CompareTable";
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
    grapes: [{ name: "Cabernet Sauvignon", percentage: 100 }],
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

describe("CompareTable", () => {
  it("renders a column per wine with its name in the header", () => {
    render(<CompareTable wines={[makeWine(1), makeWine(2, { name: "Wine 2" })]} />);
    expect(screen.getByRole("columnheader", { name: "Wine 1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Wine 2" })).toBeInTheDocument();
  });

  it("renders formatted values for winery, vintage, price, and grapes", () => {
    render(<CompareTable wines={[makeWine(1), makeWine(2)]} />);
    expect(screen.getAllByText("Test Winery")).toHaveLength(2);
    expect(screen.getAllByText("2020")).toHaveLength(2);
    expect(screen.getAllByText("$20.00")).toHaveLength(2);
    expect(screen.getAllByText("Cabernet Sauvignon (100%)")).toHaveLength(2);
  });

  it("shows 'Not rated' for a null characteristic", () => {
    render(<CompareTable wines={[makeWine(1, { tannin: null }), makeWine(2)]} />);
    expect(screen.getByText("Not rated")).toBeInTheDocument();
  });

  it("shows 'Not listed' for a null ABV", () => {
    render(<CompareTable wines={[makeWine(1, { abv: null }), makeWine(2)]} />);
    expect(screen.getByText("Not listed")).toBeInTheDocument();
  });

  it("shows an approx-USD line for a non-USD priced wine", () => {
    render(
      <CompareTable wines={[makeWine(1, { price: 50, currency: "EUR", price_usd_approx: 54 }), makeWine(2)]} />
    );
    expect(screen.getByText("€50.00")).toBeInTheDocument();
    expect(screen.getByText("≈ $54.00 USD")).toBeInTheDocument();
  });
});
