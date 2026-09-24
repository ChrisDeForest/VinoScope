import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ComparePage } from "./ComparePage";
import { useCompareSelection } from "../hooks/useCompareSelection";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import { getCachedWine, invalidateWineCache } from "../services/wineCache";
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

// Test-only sibling that shares the same useSearchParams-backed selection state as
// ComparePage, so tests can drive addWine/removeWine directly (e.g. while a wine is
// still "loading" and has no Remove control in the UI yet).
function SelectionControls() {
  const { removeWine, addWine } = useCompareSelection();
  return (
    <div>
      <button type="button" onClick={() => removeWine(1)}>
        test-remove-wine-1
      </button>
      <button type="button" onClick={() => addWine(1)}>
        test-add-wine-1
      </button>
    </div>
  );
}

function renderPageWithControls(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SelectionControls />
      <ComparePage />
    </MemoryRouter>
  );
}

describe("ComparePage", () => {
  beforeEach(() => {
    invalidateWineCache();
    localStorage.clear();
    getWineMock.mockReset();
    listWinesMock.mockReset();
  });

  it("reorders tiles and the comparison on drop", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2,3"]);
    const handle = await screen.findByRole("button", { name: /Reorder Wine 1/ });
    const target = screen.getByRole("button", { name: /Reorder Wine 3/ });
    fireEvent.dragStart(handle);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    expect(screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent)).toEqual(["Wine 2", "Wine 3", "Wine 1"]);
    expect(screen.getAllByRole("columnheader").slice(1).map((el) => el.textContent)).toEqual(["Wine 2", "Wine 3", "Wine 1"]);
  });

  it("shows a prompt instead of the table when fewer than 2 wines are selected", () => {
    renderPage(["/compare"]);
    expect(screen.getByText("Add at least 2 wines to compare.")).toBeInTheDocument();
  });

  it("reuses recently loaded details when returning to Compare", async () => {
    getWineMock.mockResolvedValue(makeWine(12));
    const first = renderPage(["/compare?wines=12"]);
    await screen.findByRole("heading", { name: "Wine 12" });
    first.unmount();
    renderPage(["/compare"]);
    await screen.findByRole("heading", { name: "Wine 12" });
    expect(getWineMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes expired wine details and does not cache failures", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      getWineMock.mockResolvedValueOnce(makeWine(12));
      expect((await getCachedWine(12)).name).toBe("Wine 12");
      now.mockReturnValue(62000);
      getWineMock.mockRejectedValueOnce(new ApiError(500, "Temporary failure"));
      await expect(getCachedWine(12)).rejects.toThrow("Temporary failure");
      getWineMock.mockResolvedValueOnce(makeWine(12, { name: "Updated wine" }));
      expect((await getCachedWine(12)).name).toBe("Updated wine");
      expect(getWineMock).toHaveBeenCalledTimes(3);
    } finally {
      now.mockRestore();
    }
  });

  it("does not let an invalidated pending response replace fresher cache data", async () => {
    let resolveOld!: (wine: WineDetail) => void;
    getWineMock.mockImplementationOnce(() => new Promise<WineDetail>((resolve) => { resolveOld = resolve; }));
    const oldRequest = getCachedWine(12);
    invalidateWineCache(12);
    getWineMock.mockResolvedValueOnce(makeWine(12, { name: "Fresh wine" }));
    await getCachedWine(12);
    resolveOld(makeWine(12, { name: "Stale wine" }));
    await oldRequest;
    expect((await getCachedWine(12)).name).toBe("Fresh wine");
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
    expect(screen.getByLabelText("Search wines to compare")).toHaveValue("wine");
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

  it("keeps the fresh fetch's result when a removed-then-re-added wine's stale request settles later", async () => {
    const pendingCalls: { resolve: (wine: WineDetail) => void; reject: (err: unknown) => void }[] = [];
    getWineMock.mockImplementation((id: number) => {
      if (id !== 1) return Promise.resolve(makeWine(id));
      return new Promise<WineDetail>((resolve, reject) => {
        pendingCalls.push({ resolve, reject });
      });
    });

    renderPageWithControls(["/compare?wines=1"]);
    await waitFor(() => expect(pendingCalls.length).toBe(1));

    const user = userEvent.setup();
    // Remove wine 1 while its fetch (call #1, the "stale" one) is still pending.
    await user.click(screen.getByText("test-remove-wine-1"));
    // Re-add the same wine ID before the stale fetch settles, kicking off call #2 (the "fresh" one).
    await user.click(screen.getByText("test-add-wine-1"));
    await waitFor(() => expect(pendingCalls.length).toBe(2));

    // Settle the stale request (call #1) as a rejection, then the fresh request (call #2) as a success.
    pendingCalls[0].reject(new ApiError(500, "stale failure"));
    pendingCalls[1].resolve(makeWine(1));

    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));
    expect(screen.queryByText("stale failure")).not.toBeInTheDocument();
  });

  it("always shows 4 slots total: filled, the picker, and inert placeholders", async () => {
    getWineMock.mockImplementation((id: number) => Promise.resolve(makeWine(id)));
    renderPage(["/compare?wines=1,2"]);
    await waitFor(() => expect(screen.getAllByText("Wine 1").length).toBeGreaterThan(0));

    expect(screen.getByLabelText("Search wines to compare")).toBeInTheDocument();
    expect(screen.getAllByText("Empty slot")).toHaveLength(1);
  });
});
