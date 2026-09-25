import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";

function renderHeader(overlay?: boolean) {
  render(
    <MemoryRouter>
      <Header overlay={overlay} />
    </MemoryRouter>
  );
}

describe("Header", () => {
  it("renders an Admin link pointing to /admin", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("href", "/admin");
  });

  it("renders a bordered, in-flow header by default", () => {
    renderHeader();
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("border-b");
    expect(header).not.toHaveClass("absolute");
  });

  it("renders a transparent header positioned over the page when overlay is set", () => {
    renderHeader(true);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("absolute", "inset-x-0", "top-0");
    expect(header).not.toHaveClass("border-b");
    expect(screen.getByRole("link", { name: "VinoScope" })).toHaveClass("text-cellar-ink");
  });
});
