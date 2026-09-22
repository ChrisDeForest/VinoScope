import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WineGrid } from "./WineGrid";
import type { WineListItem } from "../../types/wine";

function wine(id: number): WineListItem {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    grapes: [],
    price: 20,
    image_url: null,
    sweetness: null,
    acidity: null,
    tannin: null,
    body: null,
    fruitiness: null,
  };
}

describe("WineGrid", () => {
  it("renders one card per wine", () => {
    render(
      <MemoryRouter>
        <WineGrid wines={[wine(1), wine(2)]} />
      </MemoryRouter>
    );
    expect(screen.getByText("Wine 1")).toBeInTheDocument();
    expect(screen.getByText("Wine 2")).toBeInTheDocument();
  });

  it("renders skeleton placeholders when skeletonCount is set", () => {
    render(
      <MemoryRouter>
        <WineGrid wines={[]} skeletonCount={3} />
      </MemoryRouter>
    );
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });
});
