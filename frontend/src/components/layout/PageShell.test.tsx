import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageShell } from "./PageShell";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageShell>
        <p>Page content</p>
      </PageShell>
    </MemoryRouter>
  );
}

describe("PageShell", () => {
  it("on the home route, renders the skip link first, an overlay header, and a full-width main", () => {
    renderAt("/");
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Skip to all features");
    expect(links[0]).toHaveAttribute("href", "#all-features");
    expect(screen.getByRole("banner")).toHaveClass("absolute");
    expect(screen.getByRole("main")).not.toHaveClass("max-w-6xl");
  });

  it("on other routes, renders no skip link, a normal header, and a contained main", () => {
    renderAt("/pair");
    expect(screen.queryByText("Skip to all features")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).not.toHaveClass("absolute");
    expect(screen.getByRole("main")).toHaveClass("max-w-6xl");
  });
});
