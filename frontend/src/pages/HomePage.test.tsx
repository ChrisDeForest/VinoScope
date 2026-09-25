import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";
import * as api from "../services/api";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
  vi.stubGlobal("innerWidth", 1440);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((media: string) => ({
      matches: media === "(prefers-reduced-motion: reduce)",
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe("HomePage (reduced motion)", () => {
  it("renders the hero headline, five scenes, and the finale in order", async () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Find a wine you'll actually enjoy." })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Wander the whole cellar.",
      "Find your wine profile.",
      "Match the bottle to the plate.",
      "Taste two wines side by side.",
      "Learn what's in your glass.",
      "Your next favorite bottle is a few clicks away.",
    ]);
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });

  it("links every CTA to its destination", async () => {
    renderHome();
    const exploreCtas = screen.getAllByRole("link", { name: "Explore Wines" });
    expect(exploreCtas).toHaveLength(2);
    exploreCtas.forEach((link) => expect(link).toHaveAttribute("href", "/explore"));
    expect(screen.getByRole("link", { name: "Find Your Profile" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "Pair With Food" })).toHaveAttribute("href", "/pair");
    expect(screen.getByRole("link", { name: "Compare Wines" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: "Start Learning" })).toHaveAttribute("href", "/learn");
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });

  it("renders the finale as the skip-link target with all five destinations", async () => {
    renderHome();
    const finale = screen.getByRole("region", { name: "Your next favorite bottle is a few clicks away." });
    expect(finale).toHaveAttribute("id", "all-features");
    expect(finale).toHaveAttribute("tabindex", "-1");
    for (const [name, href] of [
      [/^Explore/, "/explore"],
      [/^Discover/, "/discover"],
      [/^Pair/, "/pair"],
      [/^Compare/, "/compare"],
      [/^Learn/, "/learn"],
    ] as const) {
      const link = Array.from(finale.querySelectorAll("a")).find((a) => name.test(a.textContent ?? ""));
      expect(link).toHaveAttribute("href", href);
    }
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });

  it("shows the static still instead of a canvas", async () => {
    const { container } = renderHome();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('img[src="/hero/desktop/still.webp"]')).not.toBeNull();
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });
});
