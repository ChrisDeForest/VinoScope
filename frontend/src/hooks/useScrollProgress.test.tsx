import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { scrollProgress, throughProgress, useScrollProgress } from "./useScrollProgress";

describe("scrollProgress", () => {
  it("is 0 before the element reaches the top of the viewport", () => {
    expect(scrollProgress({ top: 200, height: 2500, viewportHeight: 1000 })).toBe(0);
  });

  it("is proportional while the element scrolls through its range", () => {
    expect(scrollProgress({ top: -750, height: 2500, viewportHeight: 1000 })).toBe(0.5);
  });

  it("is 1 once the range is scrolled past", () => {
    expect(scrollProgress({ top: -4000, height: 2500, viewportHeight: 1000 })).toBe(1);
  });

  it("handles elements no taller than the viewport", () => {
    expect(scrollProgress({ top: 10, height: 800, viewportHeight: 1000 })).toBe(0);
    expect(scrollProgress({ top: 0, height: 800, viewportHeight: 1000 })).toBe(1);
  });
});

describe("throughProgress", () => {
  // viewportHeight 1000 → the default anchor line sits at 600px.
  it("is 0 until the element's top reaches the anchor line", () => {
    expect(throughProgress({ top: 900, height: 2000, viewportHeight: 1000 })).toBe(0);
    expect(throughProgress({ top: 600, height: 2000, viewportHeight: 1000 })).toBe(0);
  });

  it("is proportional while the anchor line travels through the element", () => {
    expect(throughProgress({ top: -400, height: 2000, viewportHeight: 1000 })).toBe(0.5);
  });

  it("is 1 once the element's bottom has passed the anchor line", () => {
    expect(throughProgress({ top: -1400, height: 2000, viewportHeight: 1000 })).toBe(1);
    expect(throughProgress({ top: -5000, height: 2000, viewportHeight: 1000 })).toBe(1);
  });

  it("accepts a custom anchor", () => {
    expect(throughProgress({ top: 0, height: 1000, viewportHeight: 1000, anchor: 0.5 })).toBe(0.5);
  });

  it("handles zero-height elements", () => {
    expect(throughProgress({ top: 700, height: 0, viewportHeight: 1000 })).toBe(0);
    expect(throughProgress({ top: 100, height: 0, viewportHeight: 1000 })).toBe(1);
  });
});

describe("useScrollProgress", () => {
  let rectTop = 0;

  beforeEach(() => {
    rectTop = 0;
    // Run frames synchronously; returning 0 means "nothing pending", so every
    // scroll event schedules (and immediately runs) a fresh update.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("innerHeight", 1000);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function Probe({ onProgress, enabled }: { onProgress: (p: number) => void; enabled?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    useScrollProgress(ref, onProgress, enabled);
    return <div ref={ref} />;
  }

  function mockRect(container: HTMLElement) {
    const element = container.firstElementChild as HTMLElement;
    element.getBoundingClientRect = () => ({ top: rectTop, height: 2500 }) as DOMRect;
  }

  it("reports progress on mount and on scroll", () => {
    const onProgress = vi.fn();
    rectTop = -375;
    const { container, rerender } = render(<Probe onProgress={onProgress} enabled={false} />);
    mockRect(container);
    rerender(<Probe onProgress={onProgress} enabled />);
    expect(onProgress).toHaveBeenLastCalledWith(0.25);

    rectTop = -1500;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it("does nothing when disabled", () => {
    const onProgress = vi.fn();
    render(<Probe onProgress={onProgress} enabled={false} />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("uses a custom progress function when given one", () => {
    const onProgress = vi.fn();

    function CustomProbe() {
      const ref = useRef<HTMLDivElement>(null);
      useScrollProgress(ref, onProgress, true, () => 0.42);
      return <div ref={ref} />;
    }

    render(<CustomProbe />);
    expect(onProgress).toHaveBeenLastCalledWith(0.42);
  });
});
