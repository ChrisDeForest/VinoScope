import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WineCard } from "./WineCard";
import type { WineListItem } from "../../types/wine";

const baseWine: WineListItem = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: "United States",
  region: "Napa Valley",
  grapes: [{ name: "Cabernet Sauvignon", percentage: 100 }],
  price: 79.99,
  image_url: "https://example.com/bottle.jpg",
  sweetness: 1,
  acidity: 3,
  tannin: 5,
  body: 5,
  fruitiness: 3,
};

function renderCard(wine: WineListItem, extra: { matchScore?: number; explanation?: string[] } = {}) {
  render(
    <MemoryRouter>
      <WineCard wine={wine} matchScore={extra.matchScore} explanation={extra.explanation} />
    </MemoryRouter>
  );
}

describe("WineCard", () => {
  it("renders the wine's name, winery, vintage, and price", () => {
    renderCard(baseWine);
    expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument();
    expect(screen.getByText(/Caymus Vineyards/)).toBeInTheDocument();
    expect(screen.getByText(/2022/)).toBeInTheDocument();
    expect(screen.getByText("$79.99")).toBeInTheDocument();
  });

  it("links to the wine's detail page", () => {
    renderCard(baseWine);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/wines/1");
  });

  it("shows 'Price unavailable' when price is null", () => {
    renderCard({ ...baseWine, price: null });
    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
  });

  it("falls back to a placeholder image when image_url is null", () => {
    renderCard({ ...baseWine, image_url: null });
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("data:image/svg+xml");
  });

  it("shows 'Blend' for wines with more than one grape", () => {
    renderCard({
      ...baseWine,
      grapes: [
        { name: "Cabernet Sauvignon", percentage: 60 },
        { name: "Merlot", percentage: 40 },
      ],
    });
    expect(screen.getByText("Blend")).toBeInTheDocument();
  });

  it("renders a match score badge when matchScore is provided", () => {
    renderCard(baseWine, { matchScore: 0.92 });
    expect(screen.getByText("92% Match")).toBeInTheDocument();
  });

  it("does not render a match score badge when matchScore is not provided", () => {
    renderCard(baseWine);
    expect(screen.queryByText(/% Match/)).not.toBeInTheDocument();
  });

  it("renders up to 3 explanation items joined by a middot", () => {
    renderCard(baseWine, {
      explanation: ["High tannin", "Full-bodied", "Within your price range", "Extra reason"],
    });
    expect(screen.getByText("High tannin · Full-bodied · Within your price range")).toBeInTheDocument();
  });

  it("does not render an explanation line when explanation is not provided", () => {
    renderCard(baseWine);
    expect(screen.queryByText(/High tannin/)).not.toBeInTheDocument();
  });
});
