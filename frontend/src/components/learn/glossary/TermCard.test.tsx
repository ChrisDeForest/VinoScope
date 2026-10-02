import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { termById } from "../../../content/learn/glossary";
import { TermCard, exploreHref, termCardId, termHeadingId } from "./TermCard";

function renderCard(id: string, flash = false, onJump = vi.fn()) {
  render(
    <MemoryRouter>
      <TermCard term={termById(id)!} flash={flash} onJump={onJump} />
    </MemoryRouter>
  );
  return onJump;
}

describe("ids and hrefs", () => {
  it("builds card and heading ids", () => {
    expect(termCardId("tannin")).toBe("term-tannin");
    expect(termHeadingId("tannin")).toBe("term-tannin-title");
  });

  it("encodes Explore params with %20", () => {
    expect(exploreHref({ country: "United States" })).toBe("/explore?country=United%20States");
    expect(exploreHref({ type: "rosé" })).toBe("/explore?type=ros%C3%A9");
  });
});

describe("TermCard", () => {
  it("renders an article labelled by its heading, with the deep-link id", () => {
    renderCard("tannin");
    const card = screen.getByRole("article", { name: "Tannin" });
    expect(card).toHaveAttribute("id", "term-tannin");
    expect(card).toHaveClass("scroll-mt-24");
    expect(screen.getByRole("heading", { level: 3, name: "Tannin" })).toHaveAttribute("tabindex", "-1");
  });

  it("shows the category and definition", () => {
    renderCard("tannin");
    expect(screen.getByText("Tasting")).toBeInTheDocument();
    expect(screen.getByText(/grip your tongue/)).toBeInTheDocument();
  });

  it("links a Learn see-also to the in-page anchor", () => {
    renderCard("tannin");
    expect(screen.getByRole("link", { name: "See it in How to Taste" })).toHaveAttribute("href", "#taste-tannin-title");
  });

  it("links an Explore see-also to the filter", () => {
    renderCard("new-world");
    expect(screen.getByRole("link", { name: "Browse wines from the United States" })).toHaveAttribute(
      "href",
      "/explore?country=United%20States"
    );
  });

  it("omits the see-also link when there is none", () => {
    renderCard("finish");
    expect(screen.queryByRole("link", { name: /See it in|Browse/ })).not.toBeInTheDocument();
  });

  it("renders related chips that jump instead of navigating", async () => {
    const onJump = renderCard("tannin");
    const chip = screen.getByRole("link", { name: "Maceration" });
    expect(chip).toHaveAttribute("href", "#term-maceration");
    expect(screen.getByRole("link", { name: "Oak aging" })).toHaveAttribute("href", "#term-oak-aging");
    await userEvent.click(chip);
    expect(onJump).toHaveBeenCalledWith("maceration");
  });

  it("leaves modified clicks on related chips to the browser", () => {
    const onJump = renderCard("tannin");
    const chip = screen.getByRole("link", { name: "Maceration" });
    for (const mods of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const notCancelled = fireEvent.click(chip, mods);
      expect(notCancelled).toBe(true);
    }
    expect(onJump).not.toHaveBeenCalled();
  });

  it("gives related chips a roomy tap target", () => {
    renderCard("tannin");
    expect(screen.getByRole("link", { name: "Maceration" })).toHaveClass("py-1");
  });

  it("has no related row for a term without related terms", () => {
    renderCard("serving-temperature");
    expect(screen.queryByText(/Related/)).not.toBeInTheDocument();
  });

  it("adds the flash class only when flashing", () => {
    renderCard("tannin", true);
    expect(screen.getByRole("article")).toHaveClass("term-flash");
  });

  it("does not flash by default", () => {
    renderCard("tannin");
    expect(screen.getByRole("article")).not.toHaveClass("term-flash");
  });
});
