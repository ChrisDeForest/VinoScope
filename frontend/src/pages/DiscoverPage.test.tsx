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
});
