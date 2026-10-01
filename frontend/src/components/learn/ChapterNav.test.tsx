import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChapterNav } from "./ChapterNav";
import { stubIntersectionObserver } from "../../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChapterNav", () => {
  it("renders nothing with a single chapter", () => {
    const { container } = render(<ChapterNav chapters={[{ id: "taste", label: "How to Taste" }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an anchor per chapter and marks the active one", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <ChapterNav
        chapters={[
          { id: "taste", label: "How to Taste" },
          { id: "vine", label: "Vine to Glass" },
        ]}
      />
    );
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(nav).toBeInTheDocument();
    const taste = screen.getByRole("link", { name: "How to Taste" });
    const vine = screen.getByRole("link", { name: "Vine to Glass" });
    expect(taste).toHaveAttribute("href", "#taste");
    expect(vine).toHaveAttribute("href", "#vine");
    expect(taste).toHaveAttribute("aria-current", "true");
    expect(vine).not.toHaveAttribute("aria-current");
  });

  it("does not observe chapters while hidden", () => {
    const { instances } = stubIntersectionObserver();
    // The section must exist, or the hook would skip observing for that reason instead.
    render(
      <>
        <section id="taste" />
        <ChapterNav chapters={[{ id: "taste", label: "How to Taste" }]} />
      </>
    );
    expect(instances).toHaveLength(0);
  });
});
