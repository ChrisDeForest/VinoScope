import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HeroPour } from "./HeroPour";

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((media: string) => ({
      matches: reduced,
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroPour />
    </MemoryRouter>
  );
}

beforeEach(() => {
  // jsdom has no canvas implementation; a null context keeps the poster visible.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  // jsdom's default rect is {top: 0, height: 0}, which scrollProgress reads as
  // "fully scrolled past" (top <= 0 with no range) and would hide the cue
  // before the first paint. Stub a plausible unscrolled, taller-than-viewport
  // rect so the mount-time progress read is 0, as it would be in a real
  // browser for a freshly loaded 250vh section.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 0, height: 2000 } as DOMRect);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HeroPour", () => {
  it("renders the headline, the Explore CTA, and a described media layer", () => {
    stubReducedMotion(false);
    renderHero();
    expect(screen.getByRole("heading", { level: 1, name: "Find a wine you'll actually enjoy." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Wines" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("img", { name: "Red wine being poured into a glass" })).toBeInTheDocument();
  });

  it("with motion allowed, renders a pinned canvas stage and a scroll cue", () => {
    stubReducedMotion(false);
    const { container } = renderHero();
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector(".sticky")).not.toBeNull();
    expect(screen.getByText("Scroll")).toBeInTheDocument();
  });

  it("uses the desktop poster at desktop widths", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/desktop/poster.webp"]')).not.toBeNull();
  });

  it("uses the mobile poster at phone widths", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 375);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/mobile/poster.webp"]')).not.toBeNull();
  });

  it("with reduced motion, renders only the poster: no canvas, no pin, no cue", () => {
    stubReducedMotion(true);
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".sticky")).toBeNull();
    expect(screen.queryByText("Scroll")).not.toBeInTheDocument();
    expect(container.querySelector('img[src="/hero/desktop/poster.webp"]')).not.toBeNull();
  });
});
