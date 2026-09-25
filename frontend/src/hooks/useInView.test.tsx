import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useInView } from "./useInView";
import { stubIntersectionObserver } from "../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
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

  it("stays true and disconnects after intersecting", () => {
    const { instances, fire } = stubIntersectionObserver();
    render(<Probe />);
    fire(0, true);
    expect(instances[0].disconnect).toHaveBeenCalled();
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  it("is true immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });
});
