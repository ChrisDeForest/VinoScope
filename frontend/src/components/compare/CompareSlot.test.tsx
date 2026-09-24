import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompareSlot } from "./CompareSlot";
import type { WineDetail } from "../../types/wine";

function makeWine(overrides: Partial<WineDetail> = {}): WineDetail {
  return {
    id: 1,
    name: "Caymus Cabernet Sauvignon",
    winery: "Caymus Vineyards",
    vintage: 2021,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    subregion: null,
    grapes: [],
    price: 79.99,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: 1,
    acidity: 3,
    tannin: 5,
    body: 5,
    fruitiness: 3,
    abv: 14.6,
    description: null,
    listings: [],
    ...overrides,
  };
}

describe("CompareSlot", () => {
  it("renders the wine's name, winery, and vintage", () => {
    render(<CompareSlot wine={makeWine()} onRemove={vi.fn()} />);
    expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument();
    expect(screen.getByText(/Caymus Vineyards/)).toBeInTheDocument();
    expect(screen.getByText(/2021/)).toBeInTheDocument();
  });

  it("calls onRemove when the remove button is clicked", async () => {
    const onRemove = vi.fn();
    render(<CompareSlot wine={makeWine()} onRemove={onRemove} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove Caymus Cabernet Sauvignon" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("falls back to a placeholder image when image_url is null", () => {
    render(<CompareSlot wine={makeWine({ image_url: null })} onRemove={vi.fn()} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("data:image/svg+xml");
  });
});
