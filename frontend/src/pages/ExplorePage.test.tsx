import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
    image_url: null,
    sweetness: null,
    acidity: null,
    tannin: null,
    body: null,
    fruitiness: null,
    ...overrides,
  };
}

function renderExplore() {
  render(
    <MemoryRouter>
      <ExplorePage />
    </MemoryRouter>
  );
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
});
