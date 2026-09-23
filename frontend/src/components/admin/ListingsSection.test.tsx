import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListingsSection } from "./ListingsSection";
import * as adminApi from "../../services/adminApi";
import * as api from "../../services/api";
import { ApiError } from "../../services/api";
import type { WineDetail } from "../../types/wine";

vi.mock("../../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../services/adminApi")>("../../services/adminApi");
  return { ...actual, createListing: vi.fn(), updateListing: vi.fn(), deleteListing: vi.fn() };
});
vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return { ...actual, getWine: vi.fn() };
});

const createListingMock = adminApi.createListing as unknown as ReturnType<typeof vi.fn>;
const updateListingMock = adminApi.updateListing as unknown as ReturnType<typeof vi.fn>;
const deleteListingMock = adminApi.deleteListing as unknown as ReturnType<typeof vi.fn>;
const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;

const wine: WineDetail = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: null,
  region: null,
  subregion: null,
  abv: null,
  description: null,
  grapes: [],
  price: 79.99,
  currency: "USD",
  price_usd_approx: 79.99,
  image_url: null,
  sweetness: null,
  acidity: null,
  tannin: null,
  body: null,
  fruitiness: null,
  listings: [
    {
      id: 5,
      retailer: "Total Wine",
      price: 79.99,
      currency: "USD",
      price_usd_approx: 79.99,
      product_url: null,
      availability: null,
    },
  ],
};

describe("ListingsSection", () => {
  beforeEach(() => {
    createListingMock.mockReset();
    updateListingMock.mockReset();
    deleteListingMock.mockReset();
    getWineMock.mockReset();
  });

  it("renders each existing listing", () => {
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
  });

  it("saves an edited listing and refreshes the wine", async () => {
    const onUpdated = vi.fn();
    updateListingMock.mockResolvedValue({ ...wine.listings[0], price: 89.99 });
    getWineMock.mockResolvedValue({ ...wine, price: 89.99 });
    render(<ListingsSection wine={wine} onUpdated={onUpdated} />);

    const priceInput = screen.getByLabelText(/total wine price/i);
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "89.99");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateListingMock).toHaveBeenCalledWith(1, 5, {
      price: 89.99,
      currency: "USD",
      availability: null,
      product_url: null,
    });
    expect(getWineMock).toHaveBeenCalledWith(1);
    expect(onUpdated).toHaveBeenCalledWith({ ...wine, price: 89.99 });
  });

  it("deletes a listing and refreshes the wine", async () => {
    deleteListingMock.mockResolvedValue(undefined);
    getWineMock.mockResolvedValue({ ...wine, listings: [] });
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(deleteListingMock).toHaveBeenCalledWith(1, 5);
    expect(getWineMock).toHaveBeenCalledWith(1);
  });

  it("adds a new listing and refreshes the wine", async () => {
    createListingMock.mockResolvedValue({ id: 6, retailer: "Wine.com", price: 50, currency: null, price_usd_approx: 50, product_url: null, availability: null });
    getWineMock.mockResolvedValue(wine);
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.type(screen.getByLabelText(/new listing retailer/i), "Wine.com");
    await userEvent.click(screen.getByRole("button", { name: /add listing/i }));

    expect(createListingMock).toHaveBeenCalledWith(1, {
      retailer: "Wine.com",
      price: null,
      currency: null,
      availability: null,
      product_url: null,
    });
    expect(getWineMock).toHaveBeenCalledWith(1);
  });

  it("clears the admin key and shows a session-expired message on a 401", async () => {
    const { setAdminKey, getAdminKey } = await import("../../services/adminAuth");
    setAdminKey("stale-key");
    deleteListingMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
