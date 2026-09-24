import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ComparePage } from "./ComparePage";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import type { WineDetail, WineListResponse } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getWine: vi.fn(), listWines: vi.fn() };
});

const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;
const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;

function makeWine(id: number, overrides: Partial<WineDetail> = {}): WineDetail {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    subregion: null,
    grapes: [],
    price: 20,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: 2,
    acidity: 3,
    tannin: 4,
    body: 5,
    fruitiness: 1,
    abv: 13.5,
    description: null,
    listings: [],
    ...overrides,
  };
}

function renderPage(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ComparePage />
    </MemoryRouter>
  );
}

describe("ComparePage", () => {
  beforeEach(() => {
    getWineMock.mockReset();
    listWinesMock.mockReset();
  });

  it("shows a prompt instead of the table when fewer than 2 wines are selected", () => {
    renderPage(["/compare"]);
    expect(screen.getByText("Add at least 2 wines to compare.")).toBeInTheDocument();
  });

  it("loads wines from the URL and renders the table once 2+ are loaded", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2"]);

    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));
    expect(getWineMock).toHaveBeenCalledWith(1);
    expect(getWineMock).toHaveBeenCalledWith(2);
    expect(screen.queryByText("Add at least 2 wines to compare.")).not.toBeInTheDocument();
  });

  it("adding a wine via the picker updates the selection and fetches it", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    listWinesMock.mockResolvedValue({
      total: 1,
      items: [{ ...makeWine(9), grapes: [] }],
    } as unknown as WineListResponse);
    renderPage(["/compare?wines=1,2"]);
    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText("Wine 9")).toBeInTheDocument());
    await user.click(screen.getByText("Wine 9"));

    await waitFor(() => expect(getWineMock).toHaveBeenCalledWith(9));
  });

  it("removing a wine drops it from the comparison", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2"]);
    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove Wine 1" }));

    await waitFor(() => expect(screen.getByText("Add at least 2 wines to compare.")).toBeInTheDocument());
    expect(screen.queryByText("Remove Wine 1")).not.toBeInTheDocument();
  });

  it("shows an inline error for a single failed wine without breaking the others", async () => {
    getWineMock.mockImplementation((id: number) =>
      id === 1 ? Promise.reject(new ApiError(404, "Wine not found")) : Promise.resolve(makeWine(id))
    );
    renderPage(["/compare?wines=1,2"]);

    await waitFor(() => expect(screen.getByText("Wine not found")).toBeInTheDocument());
    expect(screen.getAllByText("Wine 2").length).toBeGreaterThan(0);
  });

  it("always shows 4 slots total: filled, the picker, and inert placeholders", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2"]);
    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));

    expect(screen.getByLabelText("Search wines to compare")).toBeInTheDocument();
    expect(screen.getAllByText("Empty slot")).toHaveLength(1);
  });
});
