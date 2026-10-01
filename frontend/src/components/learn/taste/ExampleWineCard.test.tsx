import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExampleWineCard, ExampleWineCardSkeleton } from "./ExampleWineCard";
import type { WineListItem } from "../../../types/wine";

const WINE: WineListItem = {
  id: 42,
  name: "Vietti Barolo Castiglione",
  winery: "Vietti",
  vintage: 2020,
  type: "red",
  country: "Italy",
  region: "Piedmont",
  grapes: [{ name: "Nebbiolo", percentage: null }],
  price: 55,
  currency: "USD",
  price_usd_approx: 55,
  image_url: "/wines/vietti.webp",
  sweetness: 1,
  acidity: 5,
  tannin: 5,
  body: 4,
  fruitiness: 3,
};

describe("ExampleWineCard", () => {
  it("links to the wine and shows its real score and the reason", () => {
    render(
      <MemoryRouter>
        <ExampleWineCard wine={WINE} dimension="tannin" tone="high" reason="Famous for its grip." />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /Vietti Barolo Castiglione/ });
    expect(link).toHaveAttribute("href", "/wines/42");
    expect(link).toHaveTextContent("High");
    expect(link).toHaveTextContent("red · Italy");
    expect(link).toHaveTextContent("Tannin 5 / 5");
    expect(link).toHaveTextContent("Famous for its grip.");
  });

  it("renders a skeleton placeholder", () => {
    render(<ExampleWineCardSkeleton />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });
});
