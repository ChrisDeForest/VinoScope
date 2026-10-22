import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import * as api from "./services/api";
import { stubMatchMedia } from "./test/stubs";

vi.mock("./services/api", async () => {
  const actual = await vi.importActual<typeof import("./services/api")>("./services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
  stubMatchMedia({ matches: (media) => media === "(prefers-reduced-motion: reduce)" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("App routing", () => {
  it("renders the home page at /", () => {
    renderAt("/");
    expect(screen.getByText(/find a wine you'll actually enjoy/i)).toBeInTheDocument();
  });

  it("renders the Discover stub page at /discover", () => {
    renderAt("/discover");
    expect(screen.getByRole("heading", { name: "Discover" })).toBeInTheDocument();
  });

  it("renders the Pair page at /pair", () => {
    renderAt("/pair");
    expect(screen.getByRole("heading", { name: "Pair" })).toBeInTheDocument();
  });

  it("renders the Compare page at /compare", () => {
    renderAt("/compare");
    expect(screen.getByRole("heading", { name: "Compare" })).toBeInTheDocument();
  });

  it("renders the Learn page at /learn", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { level: 1, name: "Learn what's in your glass." })).toBeInTheDocument();
  });

  it("renders nav links to all main pages", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "Pair" })).toHaveAttribute("href", "/pair");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "/learn");
  });

  it.each([
    ["/", "VinoScope"],
    ["/explore", "Explore · VinoScope"],
    ["/discover", "Discover · VinoScope"],
    ["/pair", "Pair · VinoScope"],
    ["/compare", "Compare · VinoScope"],
    ["/learn", "Learn · VinoScope"],
  ])("gives %s its own tab title (also what Google Analytics reports)", (path, title) => {
    document.title = "VinoScope";
    renderAt(path);
    expect(document.title).toBe(title);
  });

  it("renders the 404 page for an unknown address", () => {
    renderAt("/no-such-page");
    expect(screen.getByRole("heading", { level: 1, name: "Well, that spilled." })).toBeInTheDocument();
  });
});
