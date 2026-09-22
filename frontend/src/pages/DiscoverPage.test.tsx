import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DiscoverPage } from "./DiscoverPage";
import * as api from "../services/api";
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
      <DiscoverPage />
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

describe("DiscoverPage", () => {
  beforeEach(() => {
    localStorage.clear();
    getRecommendationsMock.mockReset();
  });

  it("starts in form mode with no stored profile", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "See My Recommendations" })).toBeInTheDocument();
  });

  it("submitting the form fetches recommendations and switches to results mode", async () => {
    getRecommendationsMock.mockResolvedValue({
      profile: { description: ["Very dry"] },
      total: 1,
      items: [makeItem(1)],
    } satisfies RecommendationResponse);
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));

    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.getByText("Very dry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit preferences" })).toBeInTheDocument();
  });

  it("persists submitted answers to localStorage and loads results immediately on the next mount", async () => {
    getRecommendationsMock.mockResolvedValue({
      profile: { description: ["Dry"] },
      total: 1,
      items: [makeItem(2)],
    });
    const first = renderPage();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Wine type"), "red");
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    first.unmount();

    getRecommendationsMock.mockClear();
    getRecommendationsMock.mockResolvedValue({
      profile: { description: ["Dry"] },
      total: 1,
      items: [makeItem(2)],
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    expect(getRecommendationsMock).toHaveBeenCalledWith(expect.objectContaining({ type: "red" }));
  });

  it("clicking Edit preferences returns to the form pre-filled with the last answers", async () => {
    getRecommendationsMock.mockResolvedValue({
      profile: { description: [] },
      total: 1,
      items: [makeItem(1)],
    });
    renderPage();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Wine type"), "white");
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit preferences" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    expect(screen.getByLabelText("Wine type")).toHaveValue("white");
  });

  it("shows the empty-profile fallback message when profile.description is empty", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText(/no specific preferences set/i)).toBeInTheDocument());
  });

  it("shows an error message with retry when the request fails", async () => {
    getRecommendationsMock.mockRejectedValueOnce(new Error("network error"));
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText(/failed to load recommendations/i)).toBeInTheDocument());
  });

  it("clicking Load more appends the next page", async () => {
    getRecommendationsMock.mockResolvedValueOnce({
      profile: { description: [] },
      total: 2,
      items: [makeItem(1)],
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    getRecommendationsMock.mockResolvedValueOnce({
      profile: { description: [] },
      total: 2,
      items: [makeItem(2)],
    });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
  });

  it("disables the submit button and shows loading feedback while a submission is in flight", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValue(pending.promise);
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));

    const submitButton = await screen.findByRole("button", { name: "Finding wines…" });
    expect(submitButton).toBeDisabled();

    pending.resolve({ profile: { description: ["Dry"] }, total: 1, items: [makeItem(1)] });
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
  });

  it("ignores a stale load-more response when a new profile is submitted before it resolves", async () => {
    const staleLoadMore = deferred<RecommendationResponse>();
    getRecommendationsMock
      .mockResolvedValueOnce({ profile: { description: ["Dry"] }, total: 2, items: [makeItem(1)] })
      .mockReturnValueOnce(staleLoadMore.promise)
      .mockResolvedValueOnce({ profile: { description: ["Sweet"] }, total: 2, items: [makeItem(9)] });

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    await user.selectOptions(screen.getByLabelText("Wine type"), "white");
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));

    await waitFor(() => expect(screen.getByText("Wine 9")).toBeInTheDocument());
    expect(screen.queryByText("Wine 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).not.toBeDisabled();

    staleLoadMore.resolve({ profile: { description: ["Dry"] }, total: 2, items: [makeItem(2)] });
    await waitFor(() => expect(screen.queryByText("Wine 2")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Load more" })).not.toBeDisabled();
  });

  it("guards against StrictMode double-invoking the mount effect for a stored profile", async () => {
    localStorage.setItem("vinoscope-discover-profile", JSON.stringify({ type: "red" }));
    const first = deferred<RecommendationResponse>();
    const second = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    render(
      <MemoryRouter>
        <StrictMode>
          <DiscoverPage />
        </StrictMode>
      </MemoryRouter>
    );

    await waitFor(() => expect(getRecommendationsMock).toHaveBeenCalledTimes(2));

    // Resolve the earlier (now-stale) mount-effect call after the later one settles.
    second.resolve({ profile: { description: ["Second"] }, total: 1, items: [makeItem(20)] });
    await waitFor(() => expect(screen.getByText("Wine 20")).toBeInTheDocument());

    first.resolve({ profile: { description: ["First"] }, total: 1, items: [makeItem(10)] });
    await waitFor(() => expect(screen.queryByText("Wine 10")).not.toBeInTheDocument());
    expect(screen.getByText("Wine 20")).toBeInTheDocument();
  });

  it("shows an empty-results state with a way back to the form when a query has no matches", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 0, items: [] });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));

    await waitFor(() => expect(screen.getByText(/no wines match your preferences/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Back to questionnaire" }));
    expect(screen.getByRole("button", { name: "See My Recommendations" })).toBeInTheDocument();
  });
});
