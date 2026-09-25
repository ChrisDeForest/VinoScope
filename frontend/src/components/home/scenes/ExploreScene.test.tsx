import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExploreScene, pickWines } from "./ExploreScene";
import * as api from "../../../services/api";
import type { WineListItem } from "../../../types/wine";
import type { ListWinesParams, WineListResponse } from "../../../types/wine";

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

function mockByType(byType: Partial<Record<string, WineListResponse | Error>>) {
  vi.mocked(api.listWines).mockImplementation((params: ListWinesParams = {}) => {
    const result = params.type ? byType[params.type] : undefined;
    if (result instanceof Error) return Promise.reject(result);
    if (result) return Promise.resolve(result);
    return Promise.resolve({ total: 0, items: [] });
  });
}

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
});

describe("pickWines", () => {
  it("picks one wine per color in red, white, rosé order", () => {
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const red = [makeWine(1, { type: "red" })];
    const white = [makeWine(2, { type: "white" })];
    const rose = [makeWine(3, { type: "rosé" })];
    const result = pickWines([red, white, rose], random);
    expect(result.map((w) => w.id)).toEqual([1, 2, 3]);
  });

  it("uses the random function to choose an index within each color's items", () => {
    const random = vi
      .fn()
      .mockReturnValueOnce(0.99) // last of red's 2 items
      .mockReturnValueOnce(0) // first of white's 2 items
      .mockReturnValueOnce(0.4); // first of rosé's 2 items
    const red = [makeWine(1, { type: "red" }), makeWine(2, { type: "red" })];
    const white = [makeWine(3, { type: "white" }), makeWine(4, { type: "white" })];
    const rose = [makeWine(5, { type: "rosé" }), makeWine(6, { type: "rosé" })];
    const result = pickWines([red, white, rose], random);
    expect(result.map((w) => w.id)).toEqual([2, 3, 5]);
  });

  it("skips colors with no items and tops up from the remaining items of the others", () => {
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0);
    const red = [makeWine(1, { type: "red" }), makeWine(2, { type: "red" })];
    const white: WineListItem[] = [];
    const rose = [makeWine(3, { type: "rosé" }), makeWine(4, { type: "rosé" })];
    const result = pickWines([red, white, rose], random);
    expect(result.map((w) => w.id)).toEqual([1, 3, 2]);
  });

  it("never duplicates a wine by id", () => {
    const random = vi.fn().mockReturnValue(0);
    const wine = makeWine(1, { type: "red" });
    const result = pickWines([[wine], [wine], [wine]], random);
    expect(result.map((w) => w.id)).toEqual([1]);
  });

  it("returns fewer than three when there simply aren't enough wines", () => {
    const random = vi.fn().mockReturnValue(0);
    const wine = makeWine(1, { type: "red" });
    const result = pickWines([[wine], [], []], random);
    expect(result).toHaveLength(1);
  });

  it("returns an empty list when every color is empty", () => {
    const result = pickWines([[], [], []], vi.fn());
    expect(result).toEqual([]);
  });
});

describe("ExploreScene", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests red, white, and rosé wines in parallel", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(api.listWines).toHaveBeenCalledTimes(3);
    expect(api.listWines).toHaveBeenCalledWith({ type: "red", limit: 20 });
    expect(api.listWines).toHaveBeenCalledWith({ type: "white", limit: 20 });
    expect(api.listWines).toHaveBeenCalledWith({ type: "rosé", limit: 20 });
  });

  it("shows three skeleton rows while loading", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(screen.getAllByTestId("wine-skeleton")).toHaveLength(3);
  });

  it("hides the skeleton list from assistive tech and announces loading via an sr-only status", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    const { container } = renderScene();
    const skeletonList = container.querySelector('[aria-busy="true"]');
    expect(skeletonList).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading wines…");
  });

  it("shows one wine per color in red, white, rosé order", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    mockByType({
      red: { total: 1, items: [makeWine(1, { type: "red" })] },
      white: { total: 1, items: [makeWine(2, { type: "white", country: "Italy", price: 14.5 })] },
      rosé: { total: 1, items: [makeWine(3, { type: "rosé" })] },
    });
    renderScene();
    const links = await screen.findAllByRole("link", { name: /^Wine /i });
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Wine 1"),
      expect.stringContaining("Wine 2"),
      expect.stringContaining("Wine 3"),
    ]);
    expect(links[1]).toHaveAttribute("href", "/wines/2");
    expect(links[1]).toHaveTextContent("white · Italy");
    expect(links[1]).toHaveTextContent("$14.50");
    expect(screen.queryByTestId("wine-skeleton")).not.toBeInTheDocument();
  });

  it("shows the other two colors plus a top-up when one color's request fails", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    mockByType({
      red: { total: 2, items: [makeWine(1, { type: "red" }), makeWine(2, { type: "red" })] },
      white: new Error("offline"),
      rosé: { total: 1, items: [makeWine(3, { type: "rosé" })] },
    });
    renderScene();
    const links = await screen.findAllByRole("link", { name: /^Wine /i });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/wines/1", "/wines/3", "/wines/2"]);
  });

  it("falls back to descriptive copy when every request fails", async () => {
    mockByType({
      red: new Error("offline"),
      white: new Error("offline"),
      rosé: new Error("offline"),
    });
    renderScene();
    expect(await screen.findByText("Hundreds of wines by type, country, grape and price.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("wine-skeleton")).not.toBeInTheDocument());
  });

  it("falls back to descriptive copy when no wines come back for any color", async () => {
    mockByType({
      red: { total: 0, items: [] },
      white: { total: 0, items: [] },
      rosé: { total: 0, items: [] },
    });
    renderScene();
    expect(await screen.findByText("Hundreds of wines by type, country, grape and price.")).toBeInTheDocument();
  });

  it("always offers the Explore CTA", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(screen.getByRole("link", { name: "Explore Wines" })).toHaveAttribute("href", "/explore");
  });
});
