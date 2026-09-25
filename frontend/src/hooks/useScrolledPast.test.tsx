import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useScrolledPast } from "./useScrolledPast";
import { stubIntersectionObserver } from "../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    const { fire } = stubIntersectionObserver();
    renderProbe();
    fire(0, false, -50);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "true");
  });

  it("goes back to false once the sentinel is back in view", () => {
    const { fire } = stubIntersectionObserver();
    renderProbe();
    fire(0, false, -50);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-scrolled-past", "true");
    fire(0, true, 100);
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
