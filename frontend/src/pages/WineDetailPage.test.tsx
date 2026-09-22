import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WineDetailPage } from "./WineDetailPage";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import type { WineDetail } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getWine: vi.fn() };
});

const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;

const fullWine: WineDetail = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: "United States",
  region: "Napa Valley",
  subregion: null,
  abv: 14.6,
  description: "A bold, structured cabernet.",
  grapes: [{ name: "Cabernet Sauvignon", percentage: 100 }],
  price: 79.99,
  image_url: null,
  sweetness: 1,
  acidity: 3,
  tannin: 5,
  body: 5,
  fruitiness: 3,
  listings: [
    {
      retailer: "Total Wine",
      price: 79.99,
      currency: "USD",
      product_url: "https://totalwine.com/x",
      availability: "In Stock",
    },
  ],
};

function renderDetail(id = "1") {
  render(
    <MemoryRouter initialEntries={[`/wines/${id}`]}>
      <Routes>
        <Route path="/wines/:id" element={<WineDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WineDetailPage", () => {
  beforeEach(() => {
    getWineMock.mockReset();
  });

  it("renders the full wine record", async () => {
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    expect(screen.getByText(/Caymus Vineyards/)).toBeInTheDocument();
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
    expect(screen.getByText(/A bold, structured cabernet/)).toBeInTheDocument();
  });

  it("renders a not-found state on a 404", async () => {
    getWineMock.mockRejectedValue(new ApiError(404, "Wine not found"));
    renderDetail("999999");

    await waitFor(() => expect(screen.getByText("Wine not found")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /back to explore/i })).toHaveAttribute("href", "/explore");
  });

  it("renders 'No retailers currently listed' when there are no listings", async () => {
    getWineMock.mockResolvedValue({ ...fullWine, listings: [], price: null });
    renderDetail();

    await waitFor(() => expect(screen.getByText(/no retailers currently listed/i)).toBeInTheDocument());
  });
});
