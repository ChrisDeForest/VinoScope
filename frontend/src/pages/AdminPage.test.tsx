import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminPage } from "./AdminPage";
import * as adminApi from "../services/adminApi";
import * as api from "../services/api";
import { clearAdminKey, getAdminKey, setAdminKey } from "../services/adminAuth";
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

  it("shows statistics on page load when an admin key is already stored", async () => {
    setAdminKey("existing-key");
    getAdminStatsMock.mockResolvedValue(stats);
    listWinesMock.mockResolvedValue(winesResponse);

    renderAdmin();

    await waitFor(() => expect(screen.getByText(/2 wines/i)).toBeInTheDocument());
  });

  it("loads more wines when the Load more button is clicked", async () => {
    setAdminKey("existing-key");
    getAdminStatsMock.mockResolvedValue(stats);
    const firstPage: WineListResponse = {
      total: 25,
      items: Array.from({ length: 20 }, (_, i) => ({
        ...winesResponse.items[0],
        id: i + 1,
        name: `Wine ${i + 1}`,
      })),
    };
    const secondPage: WineListResponse = {
      total: 25,
      items: Array.from({ length: 5 }, (_, i) => ({
        ...winesResponse.items[0],
        id: i + 21,
        name: `Wine ${i + 21}`,
      })),
    };
    listWinesMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    renderAdmin();

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => expect(screen.getByText("Wine 21")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenCalledTimes(2);
    const secondCallArgs = listWinesMock.mock.calls[1][0];
    expect(secondCallArgs.offset).toBe(20);
  });

  it("does not leave Load more stuck loading when the query changes while a load-more request is in flight", async () => {
    setAdminKey("existing-key");
    getAdminStatsMock.mockResolvedValue(stats);
    const firstPage: WineListResponse = {
      total: 25,
      items: Array.from({ length: 20 }, (_, i) => ({
        ...winesResponse.items[0],
        id: i + 1,
        name: `Wine ${i + 1}`,
      })),
    };
    const searchPage: WineListResponse = {
      total: 5,
      items: [{ ...winesResponse.items[0], id: 999, name: "Searched Wine" }],
    };

    let resolveLoadMore: ((value: WineListResponse) => void) | undefined;
    const loadMorePromise = new Promise<WineListResponse>((resolve) => {
      resolveLoadMore = resolve;
    });

    listWinesMock
      .mockResolvedValueOnce(firstPage) // initial list load
      .mockReturnValueOnce(loadMorePromise) // load-more click, never resolves during the test
      .mockResolvedValueOnce(searchPage); // list reload triggered by the query change

    renderAdmin();

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /loading/i })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/search wines/i), { target: { value: "Searched" } });

    await waitFor(() => expect(screen.getByText("Searched Wine")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^load more$/i })).not.toBeDisabled();

    // Clean up the never-resolved promise so it doesn't leak into other tests.
    resolveLoadMore?.({ total: 25, items: [] });
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
