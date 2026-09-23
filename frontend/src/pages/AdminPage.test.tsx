import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminPage } from "./AdminPage";
import * as adminApi from "../services/adminApi";
import * as api from "../services/api";
import { clearAdminKey, getAdminKey } from "../services/adminAuth";
import { ApiError } from "../services/api";
import type { AdminStats, WineListResponse } from "../types/wine";

vi.mock("../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../services/adminApi")>("../services/adminApi");
  return { ...actual, getAdminStats: vi.fn() };
});
vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn(), getWine: vi.fn() };
});

const getAdminStatsMock = adminApi.getAdminStats as unknown as ReturnType<typeof vi.fn>;
const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;
const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;

const stats: AdminStats = {
  wines_count: 2,
  wineries_count: 1,
  retailers_count: 1,
  listings_count: 2,
  numeric: { vintage: { count: 2, null_count: 0, min: 2020, max: 2022, avg: 2021 } },
  categorical: { type: { red: 1, white: 1 } },
};

const winesResponse: WineListResponse = {
  total: 1,
  items: [
    {
      id: 1,
      name: "Caymus Cabernet Sauvignon",
      winery: "Caymus Vineyards",
      vintage: 2022,
      type: "red",
      country: "United States",
      region: "Napa Valley",
      grapes: [],
      price: 79.99,
      currency: "USD",
      price_usd_approx: 79.99,
      image_url: null,
      sweetness: 1,
      acidity: 3,
      tannin: 5,
      body: 5,
      fruitiness: 3,
    },
  ],
};

function renderAdmin() {
  render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    getAdminStatsMock.mockReset();
    listWinesMock.mockReset();
    getWineMock.mockReset();
    clearAdminKey();
  });

  afterEach(() => {
    clearAdminKey();
  });

  it("shows a login form when not logged in", () => {
    renderAdmin();
    expect(screen.getByLabelText(/admin key/i)).toBeInTheDocument();
  });

  it("shows an error and does not log in on a wrong key", async () => {
    getAdminStatsMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid admin key/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });

  it("logs in and shows the dashboard on a correct key", async () => {
    getAdminStatsMock.mockResolvedValue(stats);
    listWinesMock.mockResolvedValue(winesResponse);
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "right-key");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => expect(screen.getByText(/2 wines/i)).toBeInTheDocument());
    expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument();
  });

  it("expands the edit panel when a wine row is clicked", async () => {
    getAdminStatsMock.mockResolvedValue(stats);
    listWinesMock.mockResolvedValue(winesResponse);
    getWineMock.mockResolvedValue({ ...winesResponse.items[0], subregion: null, abv: null, description: null, listings: [] });
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "right-key");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Caymus Cabernet Sauvignon"));

    expect(await screen.findByText("Wine details")).toBeInTheDocument();
  });

  it("logs out and returns to the login form", async () => {
    getAdminStatsMock.mockResolvedValue(stats);
    listWinesMock.mockResolvedValue(winesResponse);
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "right-key");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/2 wines/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByLabelText(/admin key/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
