import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

// Like stubReducedMotion, but captures the "change" listener so a test can
// drive a live toggle the way a real matchMedia would fire it.
function stubReducedMotionListener(initial: boolean) {
  let listener: ((event: { matches: boolean }) => void) | null = null;
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((media: string) => ({
      matches: initial,
      media,
      addEventListener: (_type: string, handler: (event: { matches: boolean }) => void) => {
        listener = handler;
      },
      removeEventListener: vi.fn(),
    }))
  );
  return (next: boolean) => listener?.({ matches: next });
}

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

  it("with motion allowed, renders a pinned canvas stage and a visible scroll cue", () => {
    stubReducedMotion(false);
    const { container } = renderHero();
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector(".sticky")).not.toBeNull();
    const cue = screen.getByTestId("scroll-cue");
    expect(cue).toBeInTheDocument();
    expect(cue).toHaveClass("opacity-100");
    expect(cue).not.toHaveClass("opacity-0");
  });

  it("uses the desktop poster at desktop widths", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/desktop/poster.webp"]')).not.toBeNull();
  });

  it("uses the 1440p poster, drawn as cover, on large high-resolution displays", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 2560);
    vi.stubGlobal("innerHeight", 1440);
    const { container } = renderHero();
    const poster = container.querySelector('img[src="/hero/desktop-1440/poster.webp"]');
    expect(poster).not.toBeNull();
    expect(poster).toHaveClass("object-cover");
    expect(container.querySelector('[data-testid="mobile-seam-fade"]')).toBeNull();
  });

  it("uses the 1440p poster on retina laptops", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("devicePixelRatio", 2);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/desktop-1440/poster.webp"]')).not.toBeNull();
  });

  it("uses the mobile poster at phone widths", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 375);
    const { container } = renderHero();
    expect(container.querySelector('img[src="/hero/mobile/poster.webp"]')).not.toBeNull();
  });

  it("renders the mobile seam-fade overlay at phone widths but not at desktop widths", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 375);
    const { container } = renderHero();
    expect(container.querySelector('[data-testid="mobile-seam-fade"]')).not.toBeNull();
  });

  it("does not render the mobile seam-fade overlay at desktop widths", () => {
    stubReducedMotion(false);
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector('[data-testid="mobile-seam-fade"]')).toBeNull();
  });

  it("with reduced motion, renders only the poster: no canvas, no pin, cue hidden", () => {
    stubReducedMotion(true);
    vi.stubGlobal("innerWidth", 1440);
    const { container } = renderHero();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".sticky")).toBeNull();
    const cue = screen.getByTestId("scroll-cue");
    expect(cue).toHaveClass("opacity-0");
    expect(cue).not.toHaveClass("opacity-100");
    expect(container.querySelector('img[src="/hero/desktop/poster.webp"]')).not.toBeNull();
  });

  it("with reduced motion, never constructs an Image (no frame preloading)", () => {
    const ImageSpy = vi.fn();
    vi.stubGlobal("Image", ImageSpy);
    stubReducedMotion(true);
    vi.stubGlobal("innerWidth", 1440);
    renderHero();
    expect(ImageSpy).not.toHaveBeenCalled();
  });

  it("with motion allowed, draws a loaded frame into the canvas and reveals it", async () => {
    const contexts: ReturnType<typeof makeFakeContext>[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      const ctx = makeFakeContext(this);
      contexts.push(ctx);
      return ctx as unknown as CanvasRenderingContext2D;
    });
    vi.stubGlobal("Image", FakeImage);
    stubReducedMotion(false);
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
    const emit = stubReducedMotionListener(false);
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
