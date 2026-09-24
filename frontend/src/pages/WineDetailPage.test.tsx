import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WineDetailPage } from "./WineDetailPage";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import { invalidateWineCache } from "../services/wineCache";
import { setAdminKey, clearAdminKey } from "../services/adminAuth";
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
  currency: null,
  price_usd_approx: null,
  image_url: null,
  sweetness: 1,
  acidity: 3,
  tannin: 5,
  body: 5,
  fruitiness: 3,
  listings: [
    {
      id: 1,
      retailer: "Total Wine",
      price: 79.99,
      currency: "USD",
      price_usd_approx: 79.99,
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
    invalidateWineCache();
    localStorage.clear();
    getWineMock.mockReset();
  });

  afterEach(() => {
    clearAdminKey();
  });

  it("renders the full wine record", async () => {
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    expect(screen.getByText(/Caymus Vineyards/)).toBeInTheDocument();
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
    expect(screen.getByText(/A bold, structured cabernet/)).toBeInTheDocument();
  });

  it("adds the displayed wine to the saved comparison", async () => {
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();
    await userEvent.click(await screen.findByRole("button", { name: "Add Caymus Cabernet Sauvignon to compare" }));
    expect(screen.getByRole("button", { name: "Caymus Cabernet Sauvignon is in comparison" })).toBeDisabled();
    expect(localStorage.getItem("vinoscope.compare.wines")).toBe("1");
  });

  it("never flashes the error view while the successful response settles", async () => {
    getWineMock.mockResolvedValue(fullWine);
    let sawErrorFlash = false;
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes("Couldn't load this wine")) {
        sawErrorFlash = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    observer.disconnect();

    expect(sawErrorFlash).toBe(false);
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

  it("does not show an edit toggle when not logged in as admin", async () => {
    clearAdminKey();
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /edit this wine/i })).not.toBeInTheDocument();
  });

  it("shows an edit toggle when logged in as admin, and reveals the edit panel", async () => {
    setAdminKey("test-key");
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /edit this wine/i }));

    expect(screen.getByText("Wine details")).toBeInTheDocument();
    clearAdminKey();
  });
});
