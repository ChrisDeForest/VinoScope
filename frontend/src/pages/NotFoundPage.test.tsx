import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage";
import { stubMatchMedia } from "../test/stubs";

function Location() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{`${pathname}${search}`}</p>;
}

function renderAt(variant?: "page" | "wine") {
  render(
    <MemoryRouter initialEntries={["/nope"]}>
      <Routes>
        <Route path="/nope" element={<NotFoundPage variant={variant} />} />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  document.title = "VinoScope";
});

describe("NotFoundPage", () => {
  it("shows the page copy, title and noindex", () => {
    stubMatchMedia({ reducedMotion: false });
    renderAt();
    expect(screen.getByRole("heading", { level: 1, name: "Well, that spilled." })).toBeInTheDocument();
    expect(screen.getByText("404 · Page not found")).toBeInTheDocument();
    expect(screen.getByText("We couldn't find that page. Try searching the cellar instead:")).toBeInTheDocument();
    expect(document.title).toBe("Page not found · VinoScope");
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });

  it("shows the wine copy and title for the wine variant", () => {
    stubMatchMedia({ reducedMotion: false });
    renderAt("wine");
    expect(screen.getByRole("heading", { level: 1, name: "That wine isn't in our cellar." })).toBeInTheDocument();
    expect(screen.getByText("404 · Wine not found")).toBeInTheDocument();
    expect(document.title).toBe("Wine not found · VinoScope");
  });

  it("searches Explore with the trimmed text", async () => {
    stubMatchMedia({ reducedMotion: false });
    renderAt();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search wines" }), "  pinot noir ");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/explore?q=pinot+noir");
  });

  it("an empty search just opens Explore", async () => {
    stubMatchMedia({ reducedMotion: false });
    renderAt();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search wines" }), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByTestId("location").textContent).toBe("/explore");
  });

  it("links to Explore and home", () => {
    stubMatchMedia({ reducedMotion: false });
    renderAt();
    expect(screen.getByRole("link", { name: "Explore all wines" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute("href", "/");
  });

  it("animates the glass normally, and shows it already spilled with reduced motion", () => {
    stubMatchMedia({ reducedMotion: false });
    const { container, unmount } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(container.querySelector("svg.spilled-glass")).not.toHaveClass("is-static");
    unmount();

    stubMatchMedia({ reducedMotion: true });
    const reduced = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(reduced.container.querySelector("svg.spilled-glass")).toHaveClass("is-static");
    expect(reduced.container.querySelector("svg.spilled-glass")).toHaveAttribute("aria-hidden", "true");
  });
});
