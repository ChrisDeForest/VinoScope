import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import * as api from "./services/api";

vi.mock("./services/api", async () => {
  const actual = await vi.importActual<typeof import("./services/api")>("./services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
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

  it("renders the Learn stub page at /learn", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { name: "Learn" })).toBeInTheDocument();
  });

  it("renders nav links to all main pages", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "Pair" })).toHaveAttribute("href", "/pair");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "/learn");
  });
});
