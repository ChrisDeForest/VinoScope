import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
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
  document.documentElement.classList.remove("home-scroll-padding");
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

  it("sets a scroll-padding class on <html> on the home route and removes it elsewhere (I2)", () => {
    const { unmount } = renderAt("/");
    expect(document.documentElement).toHaveClass("home-scroll-padding");
    unmount();

    renderAt("/pair");
    expect(document.documentElement).not.toHaveClass("home-scroll-padding");
  });

  describe("route changes to and from home (C1)", () => {
    function renderRoutedApp(initialPath: string) {
      return render(
        <MemoryRouter initialEntries={[initialPath]}>
          <PageShell>
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <div id="hero-end" aria-hidden="true" />
                    <Link to="/pair">Go to pair</Link>
                  </>
                }
              />
              <Route path="/pair" element={<Link to="/">Go home</Link>} />
            </Routes>
          </PageShell>
        </MemoryRouter>
      );
    }

    it("re-subscribes and applies scroll padding when navigating from another route to home", async () => {
      const { fire } = stubIntersectionObserver();
      const user = userEvent.setup();
      renderRoutedApp("/pair");

      expect(screen.getByRole("banner")).not.toHaveClass("fixed");
      expect(document.documentElement).not.toHaveClass("home-scroll-padding");

      await user.click(screen.getByRole("link", { name: "Go home" }));

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("fixed");
      expect(header).not.toHaveClass("border-b");
      expect(document.documentElement).toHaveClass("home-scroll-padding");

      fire(0, false, -50);
      expect(header).toHaveClass("border-b");
    });

    it("resets state and re-subscribes with a fresh observer after home -> pair -> home", async () => {
      const { fire } = stubIntersectionObserver();
      const user = userEvent.setup();
      renderRoutedApp("/");

      fire(0, false, -50);
      expect(screen.getByRole("banner")).toHaveClass("border-b");

      await user.click(screen.getByRole("link", { name: "Go to pair" }));
      expect(screen.getByRole("banner")).not.toHaveClass("fixed");
      expect(document.documentElement).not.toHaveClass("home-scroll-padding");

      await user.click(screen.getByRole("link", { name: "Go home" }));
      const header = screen.getByRole("banner");
      expect(header).toHaveClass("fixed");
      expect(header).not.toHaveClass("border-b");
      expect(document.documentElement).toHaveClass("home-scroll-padding");

      fire(1, false, -50);
      expect(header).toHaveClass("border-b");
    });
  });
});
