import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useReveal, REVEAL_DELAY_MS } from "./useReveal";
import { stubIntersectionObserver, stubMatchMedia } from "../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ delayMs }: { delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const classes = useReveal(ref, delayMs === undefined ? undefined : { delayMs });
  return <div ref={ref} data-testid="probe" className={classes.join(" ")} />;
}

describe("useReveal", () => {
  it("waits REVEAL_DELAY_MS after entering view before adding is-visible", () => {
    vi.useFakeTimers();
    try {
      stubMatchMedia({ reducedMotion: false });
      const { fire } = stubIntersectionObserver();
      render(<Probe />);
      const probe = screen.getByTestId("probe");
      expect(probe).toHaveClass("scene-animate");
      expect(probe).not.toHaveClass("is-visible");
      fire(0, true);
      act(() => vi.advanceTimersByTime(REVEAL_DELAY_MS - 1));
      expect(probe).not.toHaveClass("is-visible");
      act(() => vi.advanceTimersByTime(1));
      expect(probe).toHaveClass("is-visible");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reveals at once when delayMs is 0", () => {
    stubMatchMedia({ reducedMotion: false });
    const { fire } = stubIntersectionObserver();
    render(<Probe delayMs={0} />);
    fire(0, true);
    expect(screen.getByTestId("probe")).toHaveClass("is-visible");
  });

  it("omits scene-animate under reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });
    stubIntersectionObserver();
    render(<Probe />);
    expect(screen.getByTestId("probe")).not.toHaveClass("scene-animate");
  });

  it("is visible immediately when IntersectionObserver is unavailable", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveClass("is-visible");
  });
});
