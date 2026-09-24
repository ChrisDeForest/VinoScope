import { describe, it, expect, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@testing-library/react";
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
  currency: null,
  price_usd_approx: null,
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
  it("replaces a broken remote image with a local placeholder", () => {
    renderCard(baseWine);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img").getAttribute("src")).toMatch(/^data:image/);
  });
  beforeEach(() => localStorage.clear());

  it("adds a wine without following its detail link and updates other cards", async () => {
    render(<MemoryRouter><WineCard wine={baseWine} /><WineCard wine={{ ...baseWine, id: 2, name: "Second wine" }} /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Add Caymus Cabernet Sauvignon to compare" }));
    expect(screen.getByRole("button", { name: "Caymus Cabernet Sauvignon is in comparison" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Second wine to compare" })).toBeEnabled();
    expect(localStorage.getItem("vinoscope.compare.wines")).toBe("1");
    expect(screen.getAllByRole("heading")).toHaveLength(2);
  });

  it("explains the four-wine limit", () => {
    localStorage.setItem("vinoscope.compare.wines", "2,3,4,5");
    renderCard(baseWine);
    expect(screen.getByRole("button", { name: /Comparison full/ })).toBeDisabled();
  });
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

  it("shows an approx-USD conversion line for a non-USD priced wine", () => {
    renderCard({ ...baseWine, price: 50, currency: "EUR", price_usd_approx: 54.0 });
    expect(screen.getByText("€50.00")).toBeInTheDocument();
    expect(screen.getByText("≈ $54.00 USD")).toBeInTheDocument();
  });

  it("does not show a conversion line for a USD priced wine", () => {
    renderCard(baseWine);
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });
});
