import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GrapesSection } from "./GrapesSection";
import * as adminApi from "../../services/adminApi";
import { ApiError } from "../../services/api";
import type { WineDetail } from "../../types/wine";

vi.mock("../../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../services/adminApi")>("../../services/adminApi");
  return { ...actual, updateGrapes: vi.fn() };
});

const updateGrapesMock = adminApi.updateGrapes as unknown as ReturnType<typeof vi.fn>;

const wine: WineDetail = {
  id: 1,
  name: "Bordeaux Blend",
  winery: "Some Winery",
  vintage: 2020,
  type: "red",
  country: null,
  region: null,
  subregion: null,
  abv: null,
  description: null,
  grapes: [
    { name: "Cabernet Sauvignon", percentage: 60 },
    { name: "Merlot", percentage: 40 },
  ],
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

describe("GrapesSection", () => {
  beforeEach(() => {
    updateGrapesMock.mockReset();
  });

  it("renders existing grape rows", () => {
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);
    expect(screen.getByDisplayValue("Cabernet Sauvignon")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Merlot")).toBeInTheDocument();
  });

  it("adds a blank row", async () => {
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /add grape/i }));
    expect(screen.getAllByLabelText(/name/i)).toHaveLength(3);
  });

  it("removes a row", async () => {
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[1]);
    expect(screen.queryByDisplayValue("Merlot")).not.toBeInTheDocument();
  });

  it("saves the current table, dropping blank-name rows", async () => {
    const onUpdated = vi.fn();
    const updated = { ...wine, grapes: [{ name: "Cabernet Sauvignon", percentage: 60 }, { name: "Merlot", percentage: 40 }, { name: "Petit Verdot", percentage: null }] };
    updateGrapesMock.mockResolvedValue(updated);
    render(<GrapesSection wine={wine} onUpdated={onUpdated} />);

    await userEvent.click(screen.getByRole("button", { name: /add grape/i }));
    const nameInputs = screen.getAllByLabelText(/name/i);
    await userEvent.type(nameInputs[2], "Petit Verdot");
    await userEvent.click(screen.getByRole("button", { name: /save grapes/i }));

    expect(updateGrapesMock).toHaveBeenCalledWith(1, [
      { name: "Cabernet Sauvignon", percentage: 60 },
      { name: "Merlot", percentage: 40 },
      { name: "Petit Verdot", percentage: null },
    ]);
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("clears the admin key and shows a session-expired message on a 401", async () => {
    const { setAdminKey, getAdminKey } = await import("../../services/adminAuth");
    setAdminKey("stale-key");
    updateGrapesMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /save grapes/i }));

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
