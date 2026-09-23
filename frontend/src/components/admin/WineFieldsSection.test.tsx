import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WineFieldsSection } from "./WineFieldsSection";
import * as adminApi from "../../services/adminApi";
import type { WineDetail } from "../../types/wine";

vi.mock("../../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../services/adminApi")>("../../services/adminApi");
  return { ...actual, updateWine: vi.fn() };
});

const updateWineMock = adminApi.updateWine as unknown as ReturnType<typeof vi.fn>;

const wine: WineDetail = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: "United States",
  region: "Napa Valley",
  subregion: null,
  abv: 14.6,
  description: "Bold.",
  grapes: [],
  price: null,
  currency: null,
  price_usd_approx: null,
  image_url: null,
  sweetness: 1,
  acidity: 3,
  tannin: 5,
  body: 5,
  fruitiness: 3,
  listings: [],
};

describe("WineFieldsSection", () => {
  beforeEach(() => {
    updateWineMock.mockReset();
  });

  it("disables Save until a field is changed", () => {
    render(<WineFieldsSection wine={wine} onUpdated={() => {}} />);
    expect(screen.getByRole("button", { name: /save wine/i })).toBeDisabled();
  });

  it("saves only the changed field", async () => {
    const onUpdated = vi.fn();
    updateWineMock.mockResolvedValue({ ...wine, abv: 15.0 });
    render(<WineFieldsSection wine={wine} onUpdated={onUpdated} />);

    const abvInput = screen.getByLabelText(/abv/i);
    await userEvent.clear(abvInput);
    await userEvent.type(abvInput, "15");
    await userEvent.click(screen.getByRole("button", { name: /save wine/i }));

    expect(updateWineMock).toHaveBeenCalledWith(1, { abv: 15 });
    expect(onUpdated).toHaveBeenCalledWith({ ...wine, abv: 15.0 });
  });

  it("maps a cleared nullable field to null instead of an empty string", async () => {
    const onUpdated = vi.fn();
    updateWineMock.mockResolvedValue({ ...wine, image_url: null });
    render(<WineFieldsSection wine={{ ...wine, image_url: "https://example.com/x.jpg" }} onUpdated={onUpdated} />);

    const imageUrlInput = screen.getByLabelText(/image url/i);
    await userEvent.clear(imageUrlInput);
    await userEvent.click(screen.getByRole("button", { name: /save wine/i }));

    expect(updateWineMock).toHaveBeenCalledWith(1, { image_url: null });
  });

  it("shows an error message when the save fails", async () => {
    const { ApiError } = await import("../../services/api");
    updateWineMock.mockRejectedValue(new ApiError(422, "invalid type"));
    render(<WineFieldsSection wine={wine} onUpdated={() => {}} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.type(nameInput, "!");
    await userEvent.click(screen.getByRole("button", { name: /save wine/i }));

    expect(await screen.findByText("invalid type")).toBeInTheDocument();
  });

  it("clears the admin key and shows a session-expired message on a 401", async () => {
    const { ApiError } = await import("../../services/api");
    const { setAdminKey, getAdminKey } = await import("../../services/adminAuth");
    setAdminKey("stale-key");
    updateWineMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    render(<WineFieldsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.type(screen.getByLabelText(/name/i), "!");
    await userEvent.click(screen.getByRole("button", { name: /save wine/i }));

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
