import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WineEditPanel } from "./WineEditPanel";
import type { WineDetail } from "../../types/wine";

const wine: WineDetail = {
  id: 1,
  name: "Test Wine",
  winery: "Test Winery",
  vintage: 2022,
  type: "red",
  country: null,
  region: null,
  subregion: null,
  abv: null,
  description: null,
  grapes: [],
  price: null,
  currency: null,
  price_usd_approx: null,
  image_url: null,
  sweetness: null,
  acidity: null,
  tannin: null,
  body: null,
  fruitiness: null,
  listings: [],
};

describe("WineEditPanel", () => {
  it("renders all three sections", () => {
    render(<WineEditPanel wine={wine} onUpdated={() => {}} />);
    expect(screen.getByText("Wine details")).toBeInTheDocument();
    expect(screen.getByText("Listings")).toBeInTheDocument();
    expect(screen.getByText("Grapes")).toBeInTheDocument();
  });
});
