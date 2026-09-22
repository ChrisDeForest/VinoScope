import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

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

  it("renders the Pair stub page at /pair", () => {
    renderAt("/pair");
    expect(screen.getByRole("heading", { name: "Pair" })).toBeInTheDocument();
  });

  it("renders the Compare stub page at /compare", () => {
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
