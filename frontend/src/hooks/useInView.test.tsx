import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useInView } from "./useInView";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  return <div ref={ref} data-testid="probe" data-in-view={String(inView)} />;
}

function stubIntersectionObserver() {
  const instances: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  class FakeObserver {
    callback: IntersectionObserverCallback;
    disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }
    observe = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return instances;
}

function fire(instance: { callback: IntersectionObserverCallback }, isIntersecting: boolean) {
  act(() => {
    instance.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

describe("useInView", () => {
  it("starts false and becomes true on first intersection", () => {
    const instances = stubIntersectionObserver();
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");
    fire(instances[0], true);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  it("ignores non-intersecting entries", () => {
    const instances = stubIntersectionObserver();
    render(<Probe />);
    fire(instances[0], false);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "false");
  });

  it("stays true and disconnects after intersecting", () => {
    const instances = stubIntersectionObserver();
    render(<Probe />);
    fire(instances[0], true);
    expect(instances[0].disconnect).toHaveBeenCalled();
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  it("is true immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });
});
