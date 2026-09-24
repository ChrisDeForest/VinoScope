import { describe, it, expect, vi, beforeEach } from "vitest";
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

async function selectFood(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByText(label));
}

describe("PairPage", () => {
  it("keeps the food picker open when an earlier load-more completes", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(1)] })
      .mockReturnValueOnce(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, "Steak");
    await screen.findByText("Wine 1");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    await act(async () => pending.resolve({ profile: { description: [] }, total: 2, items: [makeItem(2)] }));
    expect(screen.getByText("Steak").closest("button")).toBeEnabled();
  });

  it("uses the chosen budget and wine type for a specific dish", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Wine type"), "white");
    await user.type(screen.getByLabelText("Max price"), "30");
    await selectFood(user, "Cream pasta");
    await screen.findByText("Wine 1");
    expect(getRecommendationsMock).toHaveBeenLastCalledWith(expect.objectContaining({ type: "white", max_price: 30 }));
    expect(screen.getByRole("heading", { name: /Pairing with Cream pasta/ })).toBeInTheDocument();
  });
  beforeEach(() => {
    getRecommendationsMock.mockReset();
    sessionStorage.clear();
  });

  it("falls back to the picker instead of crashing when a saved snapshot names an unknown food key", () => {
    sessionStorage.setItem(
      "vinoscope-pair-state",
      JSON.stringify({
        mode: "results",
        selectedFood: "pasta",
        profile: [],
        items: [makeItem(1)],
        total: 1,
      })
    );
    renderPage();
    expect(screen.getByRole("heading", { name: "Pair" })).toBeInTheDocument();
    expect(screen.getByText(FOOD_PAIRINGS.steak.label)).toBeInTheDocument();
  });

  it("restores previously loaded results without refetching when remounted", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    const { unmount } = renderPage();
    const user = userEvent.setup();
    await selectFood(user, "Steak");
    await screen.findByText("Wine 1");
    unmount();

    getRecommendationsMock.mockClear();
    renderPage();
    expect(screen.getByText("Wine 1")).toBeInTheDocument();
    expect(getRecommendationsMock).not.toHaveBeenCalled();
  });

  it("starts in picker mode showing all food tiles", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Pair" })).toBeInTheDocument();
    expect(screen.getByText(FOOD_PAIRINGS.steak.label)).toBeInTheDocument();
    expect(screen.getByText(FOOD_PAIRINGS.dessert.label)).toBeInTheDocument();
  });

  it("selecting a food fetches recommendations with that food's vector and switches to results mode", async () => {
    getRecommendationsMock.mockResolvedValue({
      profile: { description: ["High tannin"] },
      total: 1,
      items: [makeItem(1)],
    } satisfies RecommendationResponse);
    renderPage();

    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(getRecommendationsMock).toHaveBeenCalledWith({
      ...FOOD_PAIRINGS.steak.vector,
      limit: 20,
      offset: 0,
    });
    expect(screen.getByText("High tannin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pairing with steak/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a different food" })).toBeInTheDocument();
  });

  it("clicking Choose a different food returns to the picker", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    expect(screen.getByText(FOOD_PAIRINGS.dessert.label)).toBeInTheDocument();
  });

  it("disables food tiles while a request is in flight", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValue(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);

    const dessertTile = screen.getByText(FOOD_PAIRINGS.dessert.label).closest("button");
    expect(dessertTile).toBeDisabled();

    pending.resolve({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
  });

  it("shows an error message with retry when the request fails", async () => {
    getRecommendationsMock.mockRejectedValueOnce(new Error("network error"));
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);
    await waitFor(() => expect(screen.getByText(/failed to load recommendations/i)).toBeInTheDocument());
  });

  it("retrying after a failed request refetches the same food", async () => {
    getRecommendationsMock.mockRejectedValueOnce(new Error("network error"));
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);
    await waitFor(() => expect(screen.getByText(/failed to load recommendations/i)).toBeInTheDocument());

    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(getRecommendationsMock).toHaveBeenLastCalledWith({ ...FOOD_PAIRINGS.steak.vector, limit: 20, offset: 0 });
  });

  it("clicking Load more appends the next page", async () => {
    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(2)] });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
  });

  it("ignores a stale load-more response when a different food is selected before it resolves", async () => {
    const staleLoadMore = deferred<RecommendationResponse>();
    getRecommendationsMock
      .mockResolvedValueOnce({ profile: { description: ["High tannin"] }, total: 2, items: [makeItem(1)] })
      .mockReturnValueOnce(staleLoadMore.promise)
      .mockResolvedValueOnce({ profile: { description: ["Sweet"] }, total: 2, items: [makeItem(9)] });

    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    await selectFood(user, FOOD_PAIRINGS.dessert.label);

    await waitFor(() => expect(screen.getByText("Wine 9")).toBeInTheDocument());
    expect(screen.queryByText("Wine 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).not.toBeDisabled();

    staleLoadMore.resolve({ profile: { description: ["High tannin"] }, total: 2, items: [makeItem(2)] });
    await waitFor(() => expect(screen.queryByText("Wine 2")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Load more" })).not.toBeDisabled();
  });

  it("shows an empty-results state with a way back to the picker when a food has no matches", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 0, items: [] });
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);

    await waitFor(() => expect(screen.getByText(/no wines available to pair right now/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Choose a different food" }));
    expect(screen.getByText(FOOD_PAIRINGS.dessert.label)).toBeInTheDocument();
  });

  it("shows a status line naming the food while a request is in flight", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValue(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await selectFood(user, FOOD_PAIRINGS.steak.label);

    expect(screen.getByText(/finding wines for steak/i)).toBeInTheDocument();

    pending.resolve({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
  });
});
