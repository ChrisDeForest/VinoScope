import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VineChapter } from "./VineChapter";
import { stubMatchMedia } from "../../../test/stubs";

let timelineTop = 0;

beforeEach(() => {
  timelineTop = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("innerHeight", 1000);
  // Only the timeline has real geometry: 2000px tall, top at `timelineTop`.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return (this.dataset.testid === "vine-timeline" ? { top: timelineTop, height: 2000 } : { top: 0, height: 0 }) as DOMRect;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderChapter() {
  return render(
    <MemoryRouter>
      <VineChapter />
    </MemoryRouter>
  );
}

describe("VineChapter", () => {
  it("renders the seven stages in order", () => {
    renderChapter();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Vineyard",
      "Harvest",
      "Crush & Press",
      "Fermentation",
      "Aging",
      "Blending & Bottling",
      "In Your Glass",
    ]);
  });

  it("grows the spine with scroll", () => {
    stubMatchMedia({ reducedMotion: false });
    timelineTop = -400; // anchor line at 600px is halfway through the 2000px timeline
    renderChapter();
    const spine = screen.getByTestId("vine-spine");
    expect(spine.style.transform).toBe("scaleY(0.5)");

    timelineTop = -2000;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(spine.style.transform).toBe("scaleY(1)");
  });

  it("draws the full spine and skips the scroll listener under reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });
    const addListener = vi.spyOn(window, "addEventListener");
    timelineTop = 900;
    renderChapter();
    expect(screen.getByTestId("vine-spine").style.transform).toBe("scaleY(1)");
    expect(addListener.mock.calls.some(([type]) => type === "scroll")).toBe(false);
  });
});
