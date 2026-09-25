import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useScrolledPast } from "./useScrolledPast";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

function fire(
  instance: { callback: IntersectionObserverCallback },
  entry: { top: number; isIntersecting: boolean }
) {
  act(() => {
    instance.callback(
      [{ boundingClientRect: { top: entry.top } as DOMRect, isIntersecting: entry.isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

function Probe({ id }: { id: string }) {
  const scrolledPast = useScrolledPast(id);
  return <div data-testid="probe" data-scrolled-past={String(scrolledPast)} />;
}

function renderProbe(id = "hero-end", withElement = true) {
  return render(
    <>
      {withElement && <div id="hero-end" aria-hidden="true" />}
      <Probe id={id} />
    </>
  );
}

describe("useScrolledPast", () => {
  it("starts false", () => {
    stubIntersectionObserver();
    renderProbe();
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "false");
  });

  it("becomes true when the sentinel's top is above the viewport and it is not intersecting", () => {
    const instances = stubIntersectionObserver();
    renderProbe();
    fire(instances[0], { top: -50, isIntersecting: false });
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "true");
  });

  it("goes back to false once the sentinel is back in view", () => {
    const instances = stubIntersectionObserver();
    renderProbe();
    fire(instances[0], { top: -50, isIntersecting: false });
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "true");
    fire(instances[0], { top: 100, isIntersecting: true });
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "false");
  });

  it("stays false when the target element does not exist", () => {
    stubIntersectionObserver();
    renderProbe("hero-end", false);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "false");
  });

  it("stays false when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    renderProbe();
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "false");
  });
});
