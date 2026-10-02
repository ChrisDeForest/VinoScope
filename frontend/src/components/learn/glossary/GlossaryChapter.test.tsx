import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { GlossaryChapter } from "./GlossaryChapter";

const scrollIntoView = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function LocationProbe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash} {type}
    </p>
  );
}

function renderAt(path = "/learn") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <GlossaryChapter />
      <LocationProbe />
    </MemoryRouter>
  );
}

const cards = () => screen.queryAllByRole("article");
const count = () => screen.getByRole("status").textContent;

describe("GlossaryChapter", () => {
  it("shows every term A–Z with a count", () => {
    renderAt();
    expect(cards()).toHaveLength(43);
    expect(count()).toBe("43 terms");
    expect(within(cards()[0]).getByRole("heading").textContent).toBe("Acidity");
  });

  it("narrows by search and updates the count", async () => {
    renderAt();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search terms" }), "phylloxera");
    expect(cards()).toHaveLength(1);
    expect(count()).toBe("1 term");
  });

  it("narrows by category", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Serving" }));
    expect(cards()).toHaveLength(6);
    expect(count()).toBe("6 terms");
  });

  it("shows an empty state that clears back to everything", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Serving" }));
    await userEvent.type(screen.getByRole("searchbox"), "zzzz");
    expect(cards()).toHaveLength(0);
    expect(count()).toBe("No terms match");
    expect(screen.getByText("No terms match “zzzz”.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(cards()).toHaveLength(43);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("jumps to a related term: hash replaced, card scrolled, heading focused, card flashed", async () => {
    renderAt("/learn?x=1");
    const tannin = screen.getByRole("article", { name: "Tannin" });
    await userEvent.click(within(tannin).getByRole("link", { name: "Maceration" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/learn?x=1#term-maceration REPLACE");
    const target = document.getElementById("term-maceration")!;
    expect(scrollIntoView.mock.instances.at(-1)).toBe(target);
    expect(document.activeElement).toBe(document.getElementById("term-maceration-title"));
    expect(target).toHaveClass("term-flash");
  });

  it("clears filters that would hide the related term", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Tasting" }));
    const tannin = screen.getByRole("article", { name: "Tannin" });
    await userEvent.click(within(tannin).getByRole("link", { name: "Maceration" }));
    expect(screen.getByRole("article", { name: "Maceration" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(43);
  });

  it("keeps filters when the related term is already visible", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: "Tasting" }));
    const dry = screen.getByRole("article", { name: "Dry" });
    await userEvent.click(within(dry).getByRole("link", { name: "Off-dry" }));
    expect(screen.getByRole("button", { name: "Tasting" })).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(11);
  });

  it("stops flashing after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAt();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(within(screen.getByRole("article", { name: "Tannin" })).getByRole("link", { name: "Maceration" }));
      expect(document.getElementById("term-maceration")).toHaveClass("term-flash");
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(document.getElementById("term-maceration")).not.toHaveClass("term-flash");
    } finally {
      vi.useRealTimers();
    }
  });
});
