import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubGtag } from "../test/stubs";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PairPage } from "./PairPage";
import * as api from "../services/api";
import { FOOD_PAIRINGS } from "../constants/foodPairings";
import type { RecommendationItem, RecommendationResponse } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getRecommendations: vi.fn() };
});

function makeItem(id: number, overrides: Partial<RecommendationItem> = {}): RecommendationItem {
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
    match_score: 0.8,
    explanation: [],
    ...overrides,
  };
}

const getRecommendationsMock = api.getRecommendations as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(
    <MemoryRouter>
      <PairPage />
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

type User = ReturnType<typeof userEvent.setup>;

function question(name: string) {
  return screen.getByRole("heading", { level: 2, name });
}

/** Picks a food and presses through the remaining steps with their current answers. */
async function findWines(user: User, label: string) {
  await user.click(screen.getByRole("button", { name: label }));
  await user.click(screen.getByRole("button", { name: `Continue with ${label.toLowerCase()}` }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Find my wines" }));
}

describe("PairPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    getRecommendationsMock.mockReset();
    sessionStorage.clear();
  });

  it("starts on the food question with Continue disabled until a dish is chosen", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Pair" })).toBeInTheDocument();
    expect(question("What are you eating?")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Steak" }));
    expect(screen.getByText(FOOD_PAIRINGS.steak.blurb)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with steak" })).toBeEnabled();
  });

  it("sends only the food's taste profile when type and budget are left open", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: ["High tannin"] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText("Wine 1");
    expect(getRecommendationsMock).toHaveBeenCalledWith({ ...FOOD_PAIRINGS.steak.vector, limit: 20, offset: 0 });
    expect(screen.getByText("High tannin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pairing with steak/i })).toBeInTheDocument();
  });

  it("uses the chosen wine types and budget", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cream pasta" }));
    await user.click(screen.getByRole("button", { name: "Continue with cream pasta" }));
    await user.click(screen.getByRole("button", { name: "White" }));
    await user.click(screen.getByRole("button", { name: "Rosé" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "$20–40" }));
    await user.click(screen.getByRole("button", { name: "Find my wines" }));
    await screen.findByText("Wine 1");
    expect(getRecommendationsMock).toHaveBeenLastCalledWith({
      ...FOOD_PAIRINGS.cream_pasta.vector,
      type: ["white", "rosé"],
      min_price: 20,
      max_price: 40,
      limit: 20,
      offset: 0,
    });
    expect(screen.getByRole("heading", { name: /Pairing with Cream pasta/ })).toBeInTheDocument();
  });

  it("reports each pairing search to analytics with its choices and result count", async () => {
    const { events } = stubGtag();
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 3, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cream pasta" }));
    await user.click(screen.getByRole("button", { name: "Continue with cream pasta" }));
    await user.click(screen.getByRole("button", { name: "White" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "$20–40" }));
    await user.click(screen.getByRole("button", { name: "Find my wines" }));
    await screen.findByText("Wine 1");
    expect(events()).toEqual([
      ["pairing_search", { food: "Cream pasta", wine_types: "white", min_price: 20, max_price: 40, results: 3 }],
    ]);
  });

  it("falls back to the quiz instead of crashing when a saved snapshot names an unknown food key", () => {
    sessionStorage.setItem(
      "vinoscope-pair-state",
      JSON.stringify({ mode: "results", selectedFood: "pasta", profile: [], items: [makeItem(1)], total: 1 })
    );
    renderPage();
    expect(question("What are you eating?")).toBeInTheDocument();
  });

  it("maps a snapshot saved by the old picker", async () => {
    sessionStorage.setItem(
      "vinoscope-pair-state",
      JSON.stringify({ mode: "picker", selectedFood: "salmon", type: "white", maxPrice: 30, profile: [], items: [], total: 0 })
    );
    renderPage();
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Salmon" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Continue with salmon" }));
    expect(screen.getByRole("button", { name: "White" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Under $20" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "$20–40" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores previously loaded results without refetching when remounted", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    const { unmount } = renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText("Wine 1");
    unmount();

    getRecommendationsMock.mockClear();
    renderPage();
    expect(screen.getByText("Wine 1")).toBeInTheDocument();
    expect(getRecommendationsMock).not.toHaveBeenCalled();
  });

  it("Choose a different food returns to the first question with the answers kept", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText("Wine 1");
    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    expect(question("What are you eating?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Steak" })).toHaveAttribute("aria-pressed", "true");
  });

  it("disables the find button and names the food while a request is in flight", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValue(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    expect(screen.getByRole("button", { name: "Finding wines…" })).toBeDisabled();
    expect(screen.getByText(/finding wines for steak/i)).toBeInTheDocument();
    pending.resolve({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    await screen.findByText("Wine 1");
  });

  it("shows an error, and retrying refetches the same request", async () => {
    getRecommendationsMock.mockRejectedValueOnce(new Error("network error"));
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText(/failed to load recommendations/i);

    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Wine 1");
    expect(getRecommendationsMock).toHaveBeenLastCalledWith({ ...FOOD_PAIRINGS.steak.vector, limit: 20, offset: 0 });
  });

  it("clicking Load more appends the next page", async () => {
    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText("Wine 1");
    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(2)] });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Wine 2");
  });

  it("keeps the quiz open when an earlier load-more completes", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock
      .mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(1)] })
      .mockReturnValueOnce(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText("Wine 1");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    await act(async () => pending.resolve({ profile: { description: [] }, total: 2, items: [makeItem(2)] }));
    expect(question("What are you eating?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dessert" })).toBeEnabled();
  });

  it("ignores a stale load-more response when a different food is chosen before it resolves", async () => {
    const staleLoadMore = deferred<RecommendationResponse>();
    getRecommendationsMock
      .mockResolvedValueOnce({ profile: { description: ["High tannin"] }, total: 2, items: [makeItem(1)] })
      .mockReturnValueOnce(staleLoadMore.promise)
      .mockResolvedValueOnce({ profile: { description: ["Sweet"] }, total: 2, items: [makeItem(9)] });

    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText("Wine 1");

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    await findWines(user, "Dessert");

    await screen.findByText("Wine 9");
    expect(screen.queryByText("Wine 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).not.toBeDisabled();

    staleLoadMore.resolve({ profile: { description: ["High tannin"] }, total: 2, items: [makeItem(2)] });
    await waitFor(() => expect(screen.queryByText("Wine 2")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Load more" })).not.toBeDisabled();
  });

  it("shows an empty-results state with a way back to the food question", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 0, items: [] });
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText(/no wines match these choices/i);
    const buttons = screen.getAllByRole("button", { name: "Choose a different food" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]);
    expect(question("What are you eating?")).toBeInTheDocument();
  });

  it("loads more with the request that produced the results, not the live quiz answers", async () => {
    sessionStorage.setItem(
      "vinoscope-pair-state",
      JSON.stringify({
        mode: "results",
        step: 0,
        food: "steak",
        types: ["white"],
        budget: ["under-20"],
        request: { food: "steak", types: ["red"], prices: { min_price: 40, max_price: 80 } },
        profile: [],
        items: [makeItem(1)],
        total: 2,
      })
    );
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 2, items: [makeItem(2)] });
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Wine 2");
    expect(getRecommendationsMock).toHaveBeenCalledWith({
      ...FOOD_PAIRINGS.steak.vector,
      type: ["red"],
      min_price: 40,
      max_price: 80,
      limit: 20,
      offset: 1,
    });
  });

  it("loads more with a legacy snapshot's original max price", async () => {
    sessionStorage.setItem(
      "vinoscope-pair-state",
      JSON.stringify({ mode: "results", selectedFood: "salmon", type: "white", maxPrice: 30, profile: [], items: [makeItem(1)], total: 2 })
    );
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 2, items: [makeItem(2)] });
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Wine 2");
    expect(getRecommendationsMock).toHaveBeenCalledWith({
      ...FOOD_PAIRINGS.salmon.vector,
      type: ["white"],
      max_price: 30,
      limit: 20,
      offset: 1,
    });
  });

  it("locks the quiz controls while a search is in flight", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValue(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    expect(screen.getByRole("button", { name: "← Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Change answer: What would you like to spend\?|Change answer: What are you eating\?/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Any price" })).toBeDisabled();
    pending.resolve({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    await screen.findByText("Wine 1");
  });

  it("moves focus to the page heading when the results appear and when the quiz returns", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await findWines(user, "Steak");
    await screen.findByText("Wine 1");
    expect(screen.getByRole("heading", { level: 1, name: "Pair" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    expect(screen.getByRole("heading", { level: 1, name: "Pair" })).toHaveFocus();
  });
});
