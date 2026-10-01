import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import type { WineListResponse } from "../../../types/wine";
import { GrapeExploreLink } from "./GrapeExploreLink";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
});

function renderLink(name: string, exploreGrape: string) {
  return render(
    <MemoryRouter>
      <GrapeExploreLink name={name} exploreGrape={exploreGrape} />
    </MemoryRouter>
  );
}

describe("GrapeExploreLink", () => {
  it("links to Explore filtered by the grape, with an encoded value", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderLink("Sauvignon Blanc", "Sauvignon Blanc");
    expect(screen.getByRole("link", { name: "Explore Sauvignon Blanc wines" })).toHaveAttribute(
      "href",
      "/explore?grape=Sauvignon%20Blanc"
    );
  });

  it("shows the catalog count once it loads, using the same filter", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 13, items: [] });
    renderLink("Pinot Noir", "Pinot Noir");
    expect(await screen.findByRole("link", { name: "Explore 13 Pinot Noir wines" })).toBeInTheDocument();
    expect(api.listWines).toHaveBeenCalledWith({ grape: "Pinot Noir", limit: 1 });
  });

  it("uses the singular for a single wine", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 1, items: [] });
    renderLink("Merlot", "Merlot");
    expect(await screen.findByRole("link", { name: "Explore 1 Merlot wine" })).toBeInTheDocument();
  });

  it("treats a count of 0 like no count", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
    renderLink("Riesling", "Riesling");
    await act(async () => {});
    expect(screen.getByRole("link", { name: "Explore Riesling wines" })).toBeInTheDocument();
  });

  it("falls back to the plain label when the count fails", async () => {
    vi.mocked(api.listWines).mockRejectedValue(new Error("network"));
    renderLink("Riesling", "Riesling");
    await act(async () => {});
    expect(screen.getByRole("link", { name: "Explore Riesling wines" })).toBeInTheDocument();
  });

  it("ignores a late count for a previous grape", async () => {
    let resolveFirst!: (value: WineListResponse) => void;
    vi.mocked(api.listWines)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ total: 9, items: [] });
    const { rerender } = renderLink("Merlot", "Merlot");
    rerender(
      <MemoryRouter>
        <GrapeExploreLink name="Chardonnay" exploreGrape="Chardonnay" />
      </MemoryRouter>
    );
    expect(await screen.findByRole("link", { name: "Explore 9 Chardonnay wines" })).toBeInTheDocument();
    await act(async () => resolveFirst({ total: 11, items: [] }));
    expect(screen.getByRole("link", { name: "Explore 9 Chardonnay wines" })).toBeInTheDocument();
  });
});
