import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, ...labels: string[]) {
  for (const label of labels) await user.click(screen.getByRole("button", { name: label }));
}

async function next(user: User) {
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

/** Presses Continue through any remaining questions, then "Show my wines". */
async function finishQuiz(user: User) {
  while (screen.queryByRole("button", { name: "Continue" })) await next(user);
  await user.click(screen.getByRole("button", { name: "Show my wines" }));
}

function question(name: string) {
  return screen.getByRole("heading", { level: 2, name });
}

const FIRST = "What are you in the mood for?";

describe("DiscoverPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    getRecommendationsMock.mockReset();
  });

  it("starts on the first question with no stored profile", () => {
    renderPage();
    expect(question(FIRST)).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No preference" })).toHaveAttribute("aria-pressed", "true");
  });

  it("walks all eight questions and sends lists, single levels and budget prices", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await pick(user, "Red", "White");
    await next(user);
    expect(question("Any countries you love?")).toBeInTheDocument();
    await pick(user, "France");
    await next(user);
    await pick(user, "$20–40", "$80–150");
    expect(screen.getByRole("button", { name: "$40–80" })).toHaveAttribute("aria-pressed", "true");
    await next(user);
    await pick(user, "Dry");
    await next(user);
    await next(user); // acidity: I'm not sure
    await pick(user, "Medium tannin");
    await next(user);
    await pick(user, "Light-bodied", "Full-bodied");
    await finishQuiz(user);

    await screen.findByText("Wine 1");
    expect(getRecommendationsMock).toHaveBeenCalledWith({
      type: ["red", "white"],
      country: ["France"],
      sweetness: 2,
      tannin: 3,
      body: [2, 4],
      min_price: 20,
      max_price: 150,
      limit: 20,
      offset: 0,
    });
  });

  it("clears a question's picks with its none pill", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await pick(user, "Red");
    await pick(user, "No preference");
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "false");
    await finishQuiz(user);
    await screen.findByText("Wine 1");
    expect(getRecommendationsMock.mock.calls[0][0]).not.toHaveProperty("type");
  });

  it("jumps back to an earlier question from its answer chip", async () => {
    renderPage();
    const user = userEvent.setup();
    await pick(user, "Red");
    await next(user);
    await user.click(screen.getByRole("button", { name: /Change answer: What are you in the mood for\?.*Red/ }));
    expect(question(FIRST)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the current quiz step after navigating away", async () => {
    const first = renderPage();
    const user = userEvent.setup();
    await pick(user, "Red");
    await next(user);
    first.unmount();
    renderPage();
    expect(question("Any countries you love?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change answer: .*Red/ })).toBeInTheDocument();
  });

  it("persists submitted answers and restores results without refetching on the next mount", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: ["Dry"] }, total: 1, items: [makeItem(2)] });
    const first = renderPage();
    const user = userEvent.setup();
    await pick(user, "Red");
    await finishQuiz(user);
    await screen.findByText("Wine 2");
    expect(JSON.parse(localStorage.getItem("vinoscope-discover-profile")!)).toEqual({ type: ["red"] });
    first.unmount();

    getRecommendationsMock.mockClear();
    renderPage();
    expect(screen.getByText("Wine 2")).toBeInTheDocument();
    expect(getRecommendationsMock).not.toHaveBeenCalled();
  });

  it("refetches instead of using a stale cache when the stored profile no longer matches it", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: ["Dry"] }, total: 1, items: [makeItem(2)] });
    const first = renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await screen.findByText("Wine 2");
    first.unmount();

    localStorage.setItem("vinoscope-discover-profile", JSON.stringify({ type: "white" }));
    getRecommendationsMock.mockClear();
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(3)] });

    renderPage();
    await screen.findByText("Wine 3");
    expect(getRecommendationsMock).toHaveBeenCalledWith(expect.objectContaining({ type: "white" }));
  });

  it("maps a profile saved by the old form into the quiz", async () => {
    localStorage.setItem(
      "vinoscope-discover-profile",
      JSON.stringify({ type: "red", sweetness: 2, min_price: 25, max_price: 60 })
    );
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Wine 1");
    await user.click(screen.getByRole("button", { name: "Edit answers" }));
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "true");
    await next(user);
    await next(user);
    expect(screen.getByRole("button", { name: "$20–40" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "$40–80" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "$80–150" })).toHaveAttribute("aria-pressed", "false");
    await next(user);
    expect(screen.getByRole("button", { name: "Dry" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Edit answers reopens the quiz at question 1 prefilled", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await pick(user, "White");
    await finishQuiz(user);
    await screen.findByText("Wine 1");
    await user.click(screen.getByRole("button", { name: "Edit answers" }));
    expect(question(FIRST)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "White" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Start over clears the saved profile and every answer", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await pick(user, "White");
    await finishQuiz(user);
    await screen.findByText("Wine 1");
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(question(FIRST)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "White" })).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("vinoscope-discover-profile")).toBeNull();
  });

  it("keeps the quiz open when an earlier load-more completes", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock
      .mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(1)] })
      .mockReturnValueOnce(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await screen.findByText("Wine 1");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await user.click(screen.getByRole("button", { name: "Edit answers" }));
    await pick(user, "White");
    await act(async () => pending.resolve({ profile: { description: [] }, total: 2, items: [makeItem(2)] }));
    expect(question(FIRST)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "White" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the empty-profile fallback message when profile.description is empty", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await waitFor(() => expect(screen.getByText(/no specific preferences set/i)).toBeInTheDocument());
  });

  it("shows an error message with retry when the request fails", async () => {
    getRecommendationsMock.mockRejectedValueOnce(new Error("network error"));
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await waitFor(() => expect(screen.getByText(/failed to load recommendations/i)).toBeInTheDocument());
  });

  it("clicking Load more appends the next page", async () => {
    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await screen.findByText("Wine 1");
    getRecommendationsMock.mockResolvedValueOnce({ profile: { description: [] }, total: 2, items: [makeItem(2)] });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Wine 2");
  });

  it("disables the last button and shows loading feedback while a submission is in flight", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValue(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    expect(await screen.findByRole("button", { name: "Finding wines…" })).toBeDisabled();
    pending.resolve({ profile: { description: ["Dry"] }, total: 1, items: [makeItem(1)] });
    await screen.findByText("Wine 1");
  });

  it("locks the answer controls while a submission is in flight", async () => {
    const pending = deferred<RecommendationResponse>();
    getRecommendationsMock.mockReturnValue(pending.promise);
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    expect(await screen.findByRole("button", { name: "← Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "I'm not sure" })).toBeDisabled();
    pending.resolve({ profile: { description: ["Dry"] }, total: 1, items: [makeItem(1)] });
    await screen.findByText("Wine 1");
  });

  it("moves focus to the page heading when switching between the quiz and the results", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 1, items: [makeItem(1)] });
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await screen.findByText("Wine 1");
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Edit answers" }));
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toHaveFocus();
  });

  it("ignores a stale load-more response when new answers are submitted before it resolves", async () => {
    const staleLoadMore = deferred<RecommendationResponse>();
    getRecommendationsMock
      .mockResolvedValueOnce({ profile: { description: ["Dry"] }, total: 2, items: [makeItem(1)] })
      .mockReturnValueOnce(staleLoadMore.promise)
      .mockResolvedValueOnce({ profile: { description: ["Sweet"] }, total: 2, items: [makeItem(9)] });

    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await screen.findByText("Wine 1");

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Edit answers" }));
    await pick(user, "White");
    await finishQuiz(user);

    await screen.findByText("Wine 9");
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
    second.resolve({ profile: { description: ["Second"] }, total: 1, items: [makeItem(20)] });
    await screen.findByText("Wine 20");
    first.resolve({ profile: { description: ["First"] }, total: 1, items: [makeItem(10)] });
    await waitFor(() => expect(screen.queryByText("Wine 10")).not.toBeInTheDocument());
    expect(screen.getByText("Wine 20")).toBeInTheDocument();
  });

  it("shows an empty-results state with a way back to the questionnaire", async () => {
    getRecommendationsMock.mockResolvedValue({ profile: { description: [] }, total: 0, items: [] });
    renderPage();
    const user = userEvent.setup();
    await finishQuiz(user);
    await screen.findByText(/no wines match your preferences/i);
    await user.click(screen.getByRole("button", { name: "Back to questionnaire" }));
    expect(question(FIRST)).toBeInTheDocument();
  });
});
