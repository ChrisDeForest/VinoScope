import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WineSearchPicker } from "./WineSearchPicker";
import * as api from "../../services/api";
import type { WineListItem, WineListResponse } from "../../types/wine";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return { ...actual, listWines: vi.fn() };
});

const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;

function makeItem(id: number, overrides: Partial<WineListItem> = {}): WineListItem {
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
    currency: "USD",
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

describe("WineSearchPicker", () => {
  beforeEach(() => {
    listWinesMock.mockReset();
  });

  it("searches on submit and lists results", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeItem(1)] } satisfies WineListResponse);
    render(<WineSearchPicker excludeIds={[]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "cabernet");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(listWinesMock).toHaveBeenCalledWith({ q: "cabernet", limit: 8 });
  });

  it("excludes already-selected wines from the results", async () => {
    listWinesMock.mockResolvedValue({ total: 2, items: [makeItem(1), makeItem(2)] });
    render(<WineSearchPicker excludeIds={[2]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.queryByText("Wine 2")).not.toBeInTheDocument();
  });

  it("calls onSelect with the wine's id when a result is clicked", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeItem(7)] });
    const onSelect = vi.fn();
    render(<WineSearchPicker excludeIds={[]} onSelect={onSelect} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText("Wine 7")).toBeInTheDocument());

    await user.click(screen.getByText("Wine 7"));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("shows a no-results message when the search returns nothing", async () => {
    listWinesMock.mockResolvedValue({ total: 0, items: [] });
    render(<WineSearchPicker excludeIds={[]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "nonexistent");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("No wines found.")).toBeInTheDocument());
  });

  it("shows an error message when the search fails", async () => {
    listWinesMock.mockRejectedValueOnce(new Error("network error"));
    render(<WineSearchPicker excludeIds={[]} onSelect={vi.fn()} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search wines to compare"), "wine");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText(/failed to search wines/i)).toBeInTheDocument());
  });
});
