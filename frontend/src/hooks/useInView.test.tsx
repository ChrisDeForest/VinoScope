import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useInView } from "./useInView";
import { stubIntersectionObserver } from "../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ delayMs }: { delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { delayMs });
  return <div ref={ref} data-testid="probe" data-in-view={String(inView)} />;
}

describe("useInView", () => {
  it("starts false and becomes true on first intersection", () => {
    const { fire } = stubIntersectionObserver();
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");
    fire(0, true);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  it("ignores non-intersecting entries", () => {
    const { fire } = stubIntersectionObserver();
    render(<Probe />);
    fire(0, false);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");
  });

  it("waits until half of the element is on screen", () => {
    const { fire } = stubIntersectionObserver();
    render(<Probe />);
    fire(0, true, 0, 0.4);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");
    fire(0, true, 0, 0.5);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  it("counts an element taller than the screen once it fills half of the screen", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe />);
    const deliver = (visibleHeight: number) =>
      act(() => {
        instances[0].callback(
          [
            {
              isIntersecting: true,
              intersectionRatio: visibleHeight / 2000,
              intersectionRect: { height: visibleHeight } as DOMRect,
              rootBounds: { height: 800 } as DOMRect,
            } as IntersectionObserverEntry,
          ],
          instances[0] as unknown as IntersectionObserver
        );
      });
    deliver(300);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");
    deliver(400);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  it("stays true and disconnects after intersecting", () => {
    const { instances, fire } = stubIntersectionObserver();
    render(<Probe />);
    fire(0, true);
    expect(instances[0].disconnect).toHaveBeenCalled();
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  describe("with delayMs", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("waits delayMs after intersecting before becoming true", () => {
      vi.useFakeTimers();
      const { instances, fire } = stubIntersectionObserver();
      render(<Probe delayMs={400} />);
      fire(0, true);
      act(() => vi.advanceTimersByTime(399));
      expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");
      expect(instances[0].disconnect).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
      expect(instances[0].disconnect).toHaveBeenCalled();
    });

    it("cancels the reveal if the element leaves view before the delay ends", () => {
      vi.useFakeTimers();
      const { fire } = stubIntersectionObserver();
      render(<Probe delayMs={400} />);
      fire(0, true);
      act(() => vi.advanceTimersByTime(200));
      fire(0, false);
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");

      fire(0, true);
      act(() => vi.advanceTimersByTime(400));
      expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
    });

    it("clears a pending reveal on unmount", () => {
      vi.useFakeTimers();
      const { fire } = stubIntersectionObserver();
      const { unmount } = render(<Probe delayMs={400} />);
      fire(0, true);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("is true immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });
});
