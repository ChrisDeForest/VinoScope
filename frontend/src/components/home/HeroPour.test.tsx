import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HeroPour } from "./HeroPour";
import { stubMatchMedia, stubConnection, restoreConnection } from "../../test/stubs";

// A minimal stand-in for HTMLImageElement that fires `onload` synchronously
// as soon as `src` is set, so preload effects resolve within the same act().
class FakeImage {
  decoding = "";
  naturalWidth = 100;
  naturalHeight = 100;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    this.onload?.();
  }
}

// A minimal stand-in for CanvasRenderingContext2D that records draw calls and
// remembers which canvas element it was created for, so a test can confirm a
// remounted canvas gets its own freshly-acquired context.
function makeFakeContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  };
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
  // browser for a freshly loaded 200vh section.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 0, height: 2000 } as DOMRect);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restoreConnection();
});

describe("HeroPour", () => {
  it("renders the headline, the Explore CTA, and a described media layer", () => {
    stubMatchMedia({ reducedMotion: false });
    renderHero();
    expect(screen.getByRole("heading", { level: 1, name: "Find a wine you'll actually enjoy." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Wines" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("img", { name: "Red wine being poured into a glass" })).toBeInTheDocument();
  });

  it("with motion allowed, renders a pinned canvas stage and a visible scroll cue", () => {
    stubMatchMedia({ reducedMotion: false });
    const { container } = renderHero();
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector(".sticky")).not.toBeNull();
    const cue = screen.getByTestId("scroll-cue");
    expect(cue).toBeInTheDocument();
    expect(cue).toHaveClass("opacity-100");
    expect(cue).not.toHaveClass("opacity-0");
  });

  it("uses the desktop poster at desktop widths", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/desktop/poster.webp"]')).not.toBeNull();
  });

  it("uses the 1440p poster, drawn as cover, on large high-resolution displays", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 2560);
    vi.stubGlobal("innerHeight", 1440);
    const { container } = renderHero();
    const poster = container.querySelector('img[src="/hero/desktop-1440/poster.webp"]');
    expect(poster).not.toBeNull();
    expect(poster).toHaveClass("object-cover");
    expect(container.querySelector('[data-testid="mobile-seam-fade"]')).toBeNull();
  });

  it("uses the 1440p poster on retina laptops", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("devicePixelRatio", 2);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/desktop-1440/poster.webp"]')).not.toBeNull();
  });

  it("uses the mobile poster at phone widths", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 375);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/mobile/poster.webp"]')).not.toBeNull();
  });

  it("renders the mobile seam-fade overlay at phone widths but not at desktop widths", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 375);
    const { container } = renderHero();
    expect(container.querySelector('[data-testid="mobile-seam-fade"]')).not.toBeNull();
  });

  it("does not render the mobile seam-fade overlay at desktop widths", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector('[data-testid="mobile-seam-fade"]')).toBeNull();
  });

  it("with reduced motion, renders the static full-glass still: no canvas, no pin, cue hidden", () => {
    stubMatchMedia({ reducedMotion: true });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".sticky")).toBeNull();
    const cue = screen.getByTestId("scroll-cue");
    expect(cue).toHaveClass("opacity-0");
    expect(cue).not.toHaveClass("opacity-100");
    expect(container.querySelector('img[src="/hero/desktop/still.webp"]')).not.toBeNull();
    expect(container.querySelector('img[src="/hero/desktop/poster.webp"]')).toBeNull();
  });

  it("with reduced motion, uses 100svh for the static hero band", () => {
    stubMatchMedia({ reducedMotion: true });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector("section.h-\\[100svh\\]")).not.toBeNull();
  });

  it("with reduced motion, never constructs an Image (no frame preloading)", () => {
    const ImageSpy = vi.fn();
    vi.stubGlobal("Image", ImageSpy);
    stubMatchMedia({ reducedMotion: true });
    vi.stubGlobal("innerWidth", 1440);
    renderHero();
    expect(ImageSpy).not.toHaveBeenCalled();
  });

  it("with data saver on and motion otherwise allowed, renders the static still instead of the canvas", () => {
    const ImageSpy = vi.fn();
    vi.stubGlobal("Image", ImageSpy);
    stubConnection({ saveData: true, effectiveType: "4g" });
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".sticky")).toBeNull();
    expect(container.querySelector('img[src="/hero/desktop/still.webp"]')).not.toBeNull();
    expect(ImageSpy).not.toHaveBeenCalled();
  });

  it("with a slow effective connection type and motion otherwise allowed, renders the static variant", () => {
    stubConnection({ saveData: false, effectiveType: "2g" });
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('img[src="/hero/desktop/still.webp"]')).not.toBeNull();
  });

  it("with motion allowed, the outer section is 200vh and the sticky stage is 100svh", () => {
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector("section.h-\\[200vh\\]")).not.toBeNull();
    expect(container.querySelector(".sticky.h-\\[100svh\\]")).not.toBeNull();
  });

  it("with motion allowed, renders the scroll sentinel right after the hero section", () => {
    stubMatchMedia({ reducedMotion: false });
    const { container } = renderHero();
    const section = container.querySelector("section");
    const sentinel = container.querySelector("#hero-end");
    expect(sentinel).not.toBeNull();
    expect(sentinel).toHaveAttribute("aria-hidden", "true");
    expect(section?.nextElementSibling).toBe(sentinel);
  });

  it("with reduced motion, also renders the scroll sentinel right after the hero section", () => {
    stubMatchMedia({ reducedMotion: true });
    const { container } = renderHero();
    const section = container.querySelector("section");
    const sentinel = container.querySelector("#hero-end");
    expect(sentinel).not.toBeNull();
    expect(section?.nextElementSibling).toBe(sentinel);
  });

  it("uses pt-24 for the mobile copy padding (one-row header)", () => {
    stubMatchMedia({ reducedMotion: false });
    const { container } = renderHero();
    expect(container.querySelector(".pt-24")).not.toBeNull();
    expect(container.querySelector(".pt-40")).toBeNull();
  });

  it("with motion allowed, draws a loaded frame into the canvas and reveals it", async () => {
    const contexts: ReturnType<typeof makeFakeContext>[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      const ctx = makeFakeContext(this);
      contexts.push(ctx);
      return ctx as unknown as CanvasRenderingContext2D;
    });
    vi.stubGlobal("Image", FakeImage);
    stubMatchMedia({ reducedMotion: false });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    await waitFor(() => expect(canvas).toHaveClass("opacity-100"));

    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts.some((ctx) => ctx.drawImage.mock.calls.length > 0)).toBe(true);
  });

  it("recovers canvas drawing after reduced motion toggles on and back off", async () => {
    const contexts: ReturnType<typeof makeFakeContext>[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      const ctx = makeFakeContext(this);
      contexts.push(ctx);
      return ctx as unknown as CanvasRenderingContext2D;
    });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("innerWidth", 1440);
    const emit = stubMatchMedia({ reducedMotion: false });
    const { container } = renderHero();

    // Initial mount: canvas present and revealed once a frame loads.
    const firstCanvas = container.querySelector("canvas");
    expect(firstCanvas).not.toBeNull();
    await waitFor(() => expect(firstCanvas).toHaveClass("opacity-100"));

    // Reduced motion turns on: the canvas unmounts entirely.
    act(() => emit(true));
    expect(container.querySelector("canvas")).toBeNull();

    // Reduced motion turns back off: a fresh canvas element mounts.
    act(() => emit(false));
    const secondCanvas = container.querySelector("canvas");
    expect(secondCanvas).not.toBeNull();
    expect(secondCanvas).not.toBe(firstCanvas);

    // It recovers: it re-acquires a context for the new canvas (rather than
    // reusing the stale one tied to the detached first canvas) and scrubs
    // again once a frame loads, ending revealed.
    await waitFor(() => expect(secondCanvas).toHaveClass("opacity-100"));
    const secondCanvasContexts = contexts.filter((ctx) => ctx.canvas === secondCanvas);
    expect(secondCanvasContexts.length).toBeGreaterThan(0);
    expect(secondCanvasContexts.some((ctx) => ctx.drawImage.mock.calls.length > 0)).toBe(true);
  });
});
