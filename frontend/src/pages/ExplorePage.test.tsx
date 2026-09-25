import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ExplorePage } from "./ExplorePage";
import * as api from "../services/api";
import type { WineListItem } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

function makeWine(id: number, overrides: Partial<WineListItem> = {}): WineListItem {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "United States",
    region: "Napa Valley",
    grapes: [],
    price: 20,
    currency: null,
    price_usd_approx: null,
    image_url: null,
    sweetness: null,
    acidity: null,
    tannin: null,
    body: null,
    fruitiness: null,
    ...overrides,
  };
}

function renderExplore(initialEntries: string[] = ["/explore"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ExplorePage />
    </MemoryRouter>
  );
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;

describe("ExplorePage", () => {
  beforeEach(() => {
    listWinesMock.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("initializes filters from the URL query string", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1, { type: "white" })] });
    renderExplore(["/explore?type=white"]);

    await waitFor(() =>
      expect(listWinesMock).toHaveBeenCalledWith(expect.objectContaining({ type: "white" }))
    );
  });

  it("reflects applied filters in the URL so it can be shared", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <ExplorePage />
        <LocationDisplay />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(dialog).getByLabelText("Type"), "white");
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toContain("type=white"));
  });

  it("preserves unrelated query params (e.g. a tracking tag) when syncing filters to the URL", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    render(
      <MemoryRouter initialEntries={["/explore?utm_source=newsletter"]}>
        <ExplorePage />
        <LocationDisplay />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.getByTestId("location").textContent).toContain("utm_source=newsletter");
  });

  it("restores previously loaded results without refetching when remounted with the same filters", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    const { unmount } = renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenCalledTimes(1);
    unmount();

    listWinesMock.mockClear();
    renderExplore();
    expect(screen.getByText("Wine 1")).toBeInTheDocument();
    expect(listWinesMock).not.toHaveBeenCalled();
  });

  it("has a visible search box that filters without opening the drawer", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search"), "cabernet{enter}");
    await waitFor(() =>
      expect(listWinesMock).toHaveBeenLastCalledWith(expect.objectContaining({ q: "cabernet" }))
    );
    expect(screen.queryByRole("dialog", { name: "Filters" })).not.toBeInTheDocument();
  });

  it("has a visible sort control that applies immediately", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Sort by"), "price_asc");
    await waitFor(() =>
      expect(listWinesMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "price_asc" }))
    );
  });

  it("shows a removable chip for each active filter and removing one re-applies without it", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    renderExplore(["/explore?type=white&min_price=10"]);
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /remove type filter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove min price filter/i })).toBeInTheDocument();

    const user = userEvent.setup();
    listWinesMock.mockResolvedValue({ total: 2, items: [makeWine(2)] });
    await user.click(screen.getByRole("button", { name: /remove type filter/i }));

    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /remove type filter/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove min price filter/i })).toBeInTheDocument();
  });

  it("refetches instead of using a stale cache when filters differ from the cached ones", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    const { unmount } = renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    unmount();

    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(2, { type: "white" })] });
    renderExplore(["/explore?type=white"]);
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenCalledWith(expect.objectContaining({ type: "white" }));
  });

  it("loads and displays wines on mount", async () => {
    listWinesMock.mockResolvedValue({ total: 2, items: [makeWine(1), makeWine(2)] });
    renderExplore();

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.getByText("Wine 2")).toBeInTheDocument();
    expect(listWinesMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 12, offset: 0 }));
  });

  it("shows an empty state message when there are no wines", async () => {
    listWinesMock.mockResolvedValue({ total: 0, items: [] });
    renderExplore();

    await waitFor(() => expect(screen.getByText(/no wines match your filters/i)).toBeInTheDocument());
  });

  it("shows an error message with retry when the request fails", async () => {
    listWinesMock.mockRejectedValueOnce(new Error("network error"));
    renderExplore();

    await waitFor(() => expect(screen.getByText(/couldn't load wines/i)).toBeInTheDocument());

    listWinesMock.mockResolvedValueOnce({ total: 1, items: [makeWine(1)] });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
  });

  it("applying a filter re-fetches with the new params and resets pagination", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filters/i }));

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(dialog).getByLabelText("Type"), "white");
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(listWinesMock).toHaveBeenLastCalledWith(expect.objectContaining({ type: "white", offset: 0, limit: 12 }))
    );
  });

  it("clicking Load more appends the next page and hides once exhausted", async () => {
    listWinesMock.mockResolvedValueOnce({ total: 2, items: [makeWine(1)] });
    renderExplore();
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    listWinesMock.mockResolvedValueOnce({ total: 2, items: [makeWine(2)] });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("ignores a stale load-more success and finally after filters change", async () => {
    const staleLoad = deferred<{ total: number; items: WineListItem[] }>();
    const freshLoad = deferred<{ total: number; items: WineListItem[] }>();
    listWinesMock.mockImplementation((params: { offset?: number; type?: string }) => {
      if (params.type === "white" && params.offset === 1) return freshLoad.promise;
      if (params.type === "white") return Promise.resolve({ total: 2, items: [makeWine(3, { type: "white" })] });
      if (params.offset === 1) return staleLoad.promise;
      return Promise.resolve({ total: 2, items: [makeWine(1)] });
    });
    renderExplore();

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(dialog).getByLabelText("Type"), "white");
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByText("Wine 3")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    staleLoad.resolve({ total: 2, items: [makeWine(2)] });
    await waitFor(() => expect(screen.queryByText("Wine 2")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    freshLoad.resolve({ total: 2, items: [makeWine(4, { type: "white" })] });
    await waitFor(() => expect(screen.getByText("Wine 4")).toBeInTheDocument());
  });

  it("ignores a stale load-more rejection after filters change", async () => {
    const staleLoad = deferred<{ total: number; items: WineListItem[] }>();
    listWinesMock.mockImplementation((params: { offset?: number; type?: string }) => {
      if (params.type === "white") return Promise.resolve({ total: 1, items: [makeWine(3, { type: "white" })] });
      if (params.offset === 1) return staleLoad.promise;
      return Promise.resolve({ total: 2, items: [makeWine(1)] });
    });
    renderExplore();

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(dialog).getByLabelText("Type"), "white");
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByText("Wine 3")).toBeInTheDocument());

    staleLoad.reject(new Error("stale load failed"));
    await waitFor(() => expect(screen.queryByText(/stale load failed|failed to load more wines/i)).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Loading..." })).not.toBeInTheDocument();
  });

  it("keeps every loaded wine when returning to Explore under StrictMode", async () => {
    // StrictMode runs effects twice in development; the restore must survive it.
    listWinesMock.mockImplementation((params: { offset: number; limit: number }) =>
      Promise.resolve({
        total: 30,
        items: Array.from({ length: params.limit }, (_, i) => makeWine(params.offset + i + 1)),
      })
    );
    const strict = () =>
      render(
        <StrictMode>
          <MemoryRouter initialEntries={["/explore"]}>
            <ExplorePage />
          </MemoryRouter>
        </StrictMode>
      );
    const { unmount } = strict();
    await waitFor(() => expect(screen.getByText("Wine 12")).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Wine 24")).toBeInTheDocument());
    unmount();

    listWinesMock.mockClear();
    strict();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText("Wine 24")).toBeInTheDocument();
    expect(screen.getByText("Showing 24 of 30")).toBeInTheDocument();
    expect(listWinesMock).not.toHaveBeenCalled();
  });

  function catalogue(total: number) {
    listWinesMock.mockImplementation((params: { offset: number; limit: number }) => {
      const count = Math.max(0, Math.min(params.limit, total - params.offset));
      return Promise.resolve({
        total,
        items: Array.from({ length: count }, (_, i) => makeWine(params.offset + i + 1)),
      });
    });
  }

  it("the Show control tops the list up to the chosen count and sizes later Load more steps", async () => {
    catalogue(200);
    renderExplore();
    await waitFor(() => expect(screen.getByText("Showing 12 of 200")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Show"), "48");
    await waitFor(() => expect(screen.getByText("Showing 48 of 200")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 12, limit: 36 }));

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Showing 96 of 200")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 48, limit: 48 }));
  });

  it("Show All loads every wine in API-sized chunks and hides Load more", async () => {
    catalogue(230);
    renderExplore();
    await waitFor(() => expect(screen.getByText("Showing 12 of 230")).toBeInTheDocument());

    await userEvent.setup().selectOptions(screen.getByLabelText("Show"), "all");
    await waitFor(() => expect(screen.getByText("Showing 230 of 230")).toBeInTheDocument());
    for (const call of listWinesMock.mock.calls) expect(call[0].limit).toBeLessThanOrEqual(100);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("choosing a smaller count shows only that many without refetching", async () => {
    catalogue(200);
    renderExplore();
    await waitFor(() => expect(screen.getByText("Showing 12 of 200")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Show"), "48");
    await waitFor(() => expect(screen.getByText("Showing 48 of 200")).toBeInTheDocument());

    listWinesMock.mockClear();
    await user.selectOptions(screen.getByLabelText("Show"), "24");
    expect(screen.getByText("Showing 24 of 200")).toBeInTheDocument();
    expect(screen.queryByText("Wine 25")).not.toBeInTheDocument();
    expect(listWinesMock).not.toHaveBeenCalled();
  });

  it("remembers the chosen count for the next visit", async () => {
    catalogue(200);
    const { unmount } = renderExplore();
    await waitFor(() => expect(screen.getByText("Showing 12 of 200")).toBeInTheDocument());
    await userEvent.setup().selectOptions(screen.getByLabelText("Show"), "24");
    await waitFor(() => expect(screen.getByText("Showing 24 of 200")).toBeInTheDocument());
    unmount();

    sessionStorage.clear();
    listWinesMock.mockClear();
    renderExplore();
    await waitFor(() => expect(screen.getByText("Showing 24 of 200")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, limit: 24 }));
  });
});
