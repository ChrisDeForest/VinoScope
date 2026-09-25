import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { PageShell } from "./PageShell";
import { stubIntersectionObserver } from "../../test/stubs";

function renderAt(path: string, children: ReactNode = <p>Page content</p>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageShell>{children}</PageShell>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PageShell", () => {
  it("on the home route, renders the skip link first, a fixed overlay header, and a full-width main", () => {
    renderAt("/");
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Skip to all features");
    expect(links[0]).toHaveAttribute("href", "#all-features");
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("fixed");
    expect(header).not.toHaveClass("border-b");
    expect(screen.getByRole("main")).not.toHaveClass("max-w-6xl");
  });

  it("on other routes, renders no skip link, a normal in-flow header, and a contained main", () => {
    renderAt("/pair");
    expect(screen.queryByText("Skip to all features")).not.toBeInTheDocument();
    const header = screen.getByRole("banner");
    expect(header).not.toHaveClass("fixed");
    expect(header).toHaveClass("border-b");
    expect(screen.getByRole("main")).toHaveClass("max-w-6xl");
  });

  it("flips the header from overlay to solid once the hero sentinel has scrolled past the top", () => {
    const { fire } = stubIntersectionObserver();
    renderAt("/", <div id="hero-end" aria-hidden="true" />);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("fixed");
    expect(header).not.toHaveClass("border-b");

    fire(0, false, -50);
    expect(header).toHaveClass("fixed", "border-b");
  });

  it("stays fixed but goes back to overlay if the sentinel scrolls back into view", () => {
    const { fire } = stubIntersectionObserver();
    renderAt("/", <div id="hero-end" aria-hidden="true" />);
    fire(0, false, -50);
    expect(screen.getByRole("banner")).toHaveClass("border-b");

    fire(0, true, 100);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("fixed");
    expect(header).not.toHaveClass("border-b");
  });
});
