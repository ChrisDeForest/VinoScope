import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../services/api";
import { LearnPage } from "./LearnPage";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

const scrollIntoView = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;
const scrollTo = vi.fn();

beforeEach(() => {
  scrollTo.mockReset();
  vi.stubGlobal("scrollTo", scrollTo);
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <LearnPage />
    </MemoryRouter>
  );
}

describe("LearnPage hash pinning", () => {
  let resizeCallbacks: Array<() => void>;
  const disconnect = vi.fn();

  beforeEach(() => {
    resizeCallbacks = [];
    disconnect.mockReset();
    class FakeResizeObserver {
      connected = true;
      constructor(callback: () => void) {
        // Like the real thing, a disconnected observer never fires again.
        resizeCallbacks.push(() => this.connected && callback());
      }
      observe() {}
      unobserve() {}
      disconnect = () => {
        this.connected = false;
        disconnect();
      };
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  const resize = () => act(() => resizeCallbacks.forEach((callback) => callback()));

  it("re-scrolls the target (instantly) when layout resizes after arrival", () => {
    renderAt("/learn#vine");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    resize();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.instances[1]).toBe(document.getElementById("vine"));
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "start" });
  });

  it.each([["wheel"], ["touchstart"], ["keydown"], ["pointerdown"]])("stops re-scrolling after a user %s", (type) => {
    renderAt("/learn#vine");
    window.dispatchEvent(new Event(type));
    resize();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
  });

  it("stops pinning after the settle window", () => {
    vi.useFakeTimers();
    try {
      renderAt("/learn#vine");
      act(() => {
        vi.advanceTimersByTime(4100);
      });
      resize();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(disconnect).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not observe without a hash", () => {
    renderAt("/learn");
    expect(resizeCallbacks).toHaveLength(0);
  });

  it("disconnects on unmount", () => {
    const view = render(
      <MemoryRouter initialEntries={["/learn#vine"]}>
        <LearnPage />
      </MemoryRouter>
    );
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("does nothing without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    expect(() => renderAt("/learn#vine")).not.toThrow();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe("LearnPage", () => {
  it("renders the intro and the How to Taste chapter", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { level: 1, name: "Learn what's in your glass." })).toBeInTheDocument();
    const chapter = screen.getByRole("region", { name: "Five things your mouth is measuring" });
    expect(chapter).toHaveAttribute("id", "taste");
    expect(screen.getByText("01 · How to Taste")).toBeInTheDocument();
  });

  it("shows the chapter nav with both chapters", () => {
    renderAt("/learn");
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(within(nav).getByRole("link", { name: "How to Taste" })).toHaveAttribute("href", "#taste");
    expect(within(nav).getByRole("link", { name: "Vine to Glass" })).toHaveAttribute("href", "#vine");
  });

  it("renders the Vine to Glass chapter second", () => {
    renderAt("/learn");
    const chapter = screen.getByRole("region", { name: "From vine to glass" });
    expect(chapter).toHaveAttribute("id", "vine");
    expect(screen.getByText("02 · Vine to Glass")).toBeInTheDocument();
  });

  it("scrolls #vine into view on arrival", () => {
    renderAt("/learn#vine");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("vine"));
  });

  it("scrolls a #hash chapter into view on arrival", () => {
    renderAt("/learn#taste");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("taste"));
  });

  it("does not scroll an element into view without a hash", () => {
    renderAt("/learn");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("resets the window to the top on arrival without a hash", () => {
    renderAt("/learn");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("leaves the window scroll alone when there is a hash", () => {
    renderAt("/learn#taste");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("survives a malformed hash", () => {
    expect(() => renderAt("/learn#%zz")).not.toThrow();
  });

  it("lists all four chapters in the nav", () => {
    renderAt("/learn");
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "How to Taste",
      "Vine to Glass",
      "Key Grapes",
      "Glossary",
    ]);
  });

  it("renders the Glossary chapter fourth", () => {
    renderAt("/learn");
    expect(screen.getByRole("region", { name: "Words to know" })).toHaveAttribute("id", "glossary");
    expect(screen.getByText("04 · Glossary")).toBeInTheDocument();
  });

  it("scrolls to a glossary term from the hash on arrival", () => {
    renderAt("/learn#term-tannin");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("term-tannin"));
  });

  it("renders the Key Grapes chapter third", () => {
    renderAt("/learn");
    expect(screen.getByRole("region", { name: "Seven grapes to know" })).toHaveAttribute("id", "grapes");
    expect(screen.getByText("03 · Key Grapes")).toBeInTheDocument();
  });

  it("opens and scrolls to a grape from the hash on arrival", () => {
    renderAt("/learn#grape-pinot-noir");
    const tab = screen.getByRole("tab", { name: "Pinot Noir" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(scrollIntoView.mock.instances[0]).toBe(tab);
  });
});
