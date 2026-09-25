import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExploreScene } from "./ExploreScene";
import * as api from "../../../services/api";
import type { WineListItem } from "../../../types/wine";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

function makeWine(id: number, overrides: Partial<WineListItem> = {}): WineListItem {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "France",
    region: null,
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

function renderScene() {
  return render(
    <MemoryRouter>
      <ExploreScene />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
});

describe("ExploreScene", () => {
  it("requests three wines", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(api.listWines).toHaveBeenCalledWith({ limit: 3 });
  });

  it("shows three skeleton rows while loading", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(screen.getAllByTestId("wine-skeleton")).toHaveLength(3);
  });

  it("shows up to three linked wines with type, country, and price", async () => {
    vi.mocked(api.listWines).mockResolvedValue({
      total: 4,
      items: [makeWine(1), makeWine(2, { type: "white", country: "Italy", price: 14.5 }), makeWine(3), makeWine(4)],
    });
    renderScene();
    const link = await screen.findByRole("link", { name: /Wine 2/ });
    expect(link).toHaveAttribute("href", "/wines/2");
    expect(link).toHaveTextContent("white · Italy");
    expect(link).toHaveTextContent("$14.50");
    expect(screen.queryByRole("link", { name: /Wine 4/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("wine-skeleton")).not.toBeInTheDocument();
  });

  it("falls back to descriptive copy when the request fails", async () => {
    vi.mocked(api.listWines).mockRejectedValue(new Error("offline"));
    renderScene();
    expect(await screen.findByText("Hundreds of wines by type, country, grape and price.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("wine-skeleton")).not.toBeInTheDocument());
  });

  it("falls back to descriptive copy when no wines come back", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
    renderScene();
    expect(await screen.findByText("Hundreds of wines by type, country, grape and price.")).toBeInTheDocument();
  });

  it("always offers the Explore CTA", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(screen.getByRole("link", { name: "Explore Wines" })).toHaveAttribute("href", "/explore");
  });
});
