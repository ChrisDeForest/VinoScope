# Home Page Scroll Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per this project's review cadence, skip per-task reviews and run one final whole-branch review on a strong model after Task 9.

**Goal:** Replace the static VinoScope home page with a scroll-scrubbed cinematic wine-pour hero followed by five gold-line-art feature scenes and a finale button grid.

**Architecture:** `PageShell` switches into a full-bleed "home mode" on `/` (skip link, overlay header, uncontained `<main>`). `HeroPour` pins a canvas that draws a pre-rendered WebP frame sequence chosen by scroll progress. Each feature scene is a `Scene` section that gets an `is-visible` class the first time it enters the viewport; plain CSS transitions in `home.css` animate the inline SVG line art from an initial state to a resting state. No animation library.

**Tech Stack:** React 18, React Router 6, TypeScript (strict, `noUnusedLocals`), Tailwind 3.4, Vite 5, Vitest 2 + jsdom + Testing Library, ffmpeg (asset step only).

**Spec:** `docs/superpowers/specs/2026-09-24-home-scroll-experience-design.md`

## Global Constraints

- No new runtime dependencies. Main JS chunk growth ≤ 15 kB gzip (baseline `index-*.js` 71.88 kB gzip).
- Only `transform`, `opacity`, and `stroke-dashoffset` may be animated.
- Every scene's *resting* CSS state is its final state; initial states live only under `.scene-animate:not(.is-visible)`. Reduced motion ⇒ no `scene-animate` class, no canvas, no sticky pin, no frame preloading.
- Hero frame sets: `frontend/public/hero/{desktop,mobile}/frame-NNN.webp` (1-based, 3-digit) + `poster.webp`; both sets have exactly `HERO_FRAME_COUNT` frames; desktop above 768px width, mobile at 768px and below.
- Copy is fixed by the spec: hero `<h1>` "Find a wine you'll actually enjoy."; CTAs "Explore Wines", "Find Your Profile", "Pair With Food", "Compare Wines", "Start Learning"; finale heading "Your next favorite bottle is a few clicks away."
- Theme work must keep all three themes (`dark-burgundy`, `cream-terracotta`, `charcoal-gold`) complete; cellar tokens are identical in every theme.
- Do not change behavior or tests of other pages beyond what a task states.
- All commands run from `frontend/` unless a step says otherwise. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `frontend/public/hero/{desktop,mobile}/*` | Modify (re-export) | 65-frame WebP sequences + posters |
| `frontend/src/utils/frameSequence.ts` (+ test) | Create | Frame math: set choice, URLs, progress→index, nearest loaded, canvas placement |
| `frontend/src/hooks/usePrefersReducedMotion.ts` (+ test) | Create | Reduced-motion media query state |
| `frontend/src/hooks/useInView.ts` (+ test) | Create | One-shot viewport entry detection |
| `frontend/src/hooks/useScrollProgress.ts` (+ test) | Create | Element scroll progress callback + pure `scrollProgress` |
| `frontend/src/theme/themes.css` | Modify | Wine + cellar tokens |
| `frontend/tailwind.config.js` | Modify | `wine-*` and `cellar-*` colors |
| `frontend/src/index.css.test.js` | Modify | Assert new tokens survive the build |
| `frontend/src/components/layout/Header.tsx` (+ test) | Modify | `overlay` prop |
| `frontend/src/components/layout/PageShell.tsx` (+ new test) | Modify | Home mode + skip link |
| `frontend/src/App.test.tsx` | Modify | Stub reduced motion + mock `listWines` for `/` |
| `frontend/src/components/home/home.css` | Create | Scene animation states |
| `frontend/src/components/home/art/cssVars.ts` | Create | Typed CSS custom-property style helper |
| `frontend/src/components/home/art/Glass.tsx` | Create | Reusable line-art wine glass |
| `frontend/src/components/home/Scene.tsx` (+ test) | Create | Scene shell + `SceneCta` |
| `frontend/src/components/home/HeroPour.tsx` (+ test) | Create | Pinned scroll-scrubbed hero |
| `frontend/src/components/home/scenes/ExploreScene.tsx` (+ test) | Create | Scene 1 with live wines |
| `frontend/src/components/home/scenes/{Discover,Pair,Compare,Learn}Scene.tsx` (+ one test) | Create | Scenes 2–5 |
| `frontend/src/components/home/Finale.tsx` | Create | Closing grid (`#all-features`) |
| `frontend/src/pages/HomePage.tsx` (+ new test) | Modify | Composition |

---

### Task 1: Hero frame assets and frame-sequence utilities

**Files:**
- Modify: `frontend/public/hero/desktop/*`, `frontend/public/hero/mobile/*`
- Create: `frontend/src/utils/frameSequence.ts`
- Test: `frontend/src/utils/frameSequence.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact exports from `utils/frameSequence.ts`):
  - `type FrameSet = "desktop" | "mobile"`
  - `type FramePlacement = "cover" | "fit-width-bottom"`
  - `interface FrameRect { x: number; y: number; width: number; height: number }`
  - `const HERO_FRAME_COUNT: number` (65 unless Step 1 reports a different count)
  - `const MOBILE_MAX_WIDTH = 768`
  - `frameSetForWidth(width: number): FrameSet`
  - `frameUrl(set: FrameSet, index: number): string` — `index` is 0-based
  - `posterUrl(set: FrameSet): string`
  - `frameIndexForProgress(progress: number, frameCount: number): number`
  - `nearestLoadedFrame(target: number, loaded: ReadonlyArray<boolean>): number | null`
  - `placeFrame(placement: FramePlacement, srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): FrameRect`

- [ ] **Step 1: Re-export both frame sets at 8 fps**

Run from the repo root (Git Bash). It prefers the treated source clip and falls back to resampling the existing frames:

```bash
cd frontend/public/hero
TREATED="C:/Users/Chris/AppData/Local/Temp/claude/F--College-4---Senior-Year-Fall-2026-Wines-of-the-World-Final-Project/c53df939-e551-4a78-9ca2-afc5cb722188/scratchpad/treated.mp4"
for set in desktop mobile; do
  rm -rf "$set.new" && mkdir -p "$set.new"
  if [ -f "$TREATED" ]; then
    if [ "$set" = desktop ]; then VF="fps=8"; else VF="fps=8,crop=540:720:440:0"; fi
    ffmpeg -loglevel error -y -i "$TREATED" -vf "$VF" -c:v libwebp -quality 68 "$set.new/frame-%03d.webp"
  else
    ffmpeg -loglevel error -y -framerate 12 -i "$set/frame-%03d.webp" -vf fps=8 -c:v libwebp -quality 68 "$set.new/frame-%03d.webp"
  fi
  cp "$set.new/frame-001.webp" "$set.new/poster.webp"
  rm -rf "$set" && mv "$set.new" "$set"
done
echo "desktop: $(ls desktop/frame-*.webp | wc -l) frames, $(du -sh desktop | cut -f1)"
echo "mobile:  $(ls mobile/frame-*.webp | wc -l) frames, $(du -sh mobile | cut -f1)"
```

Expected: both sets report the same count (64 or 65); desktop ≈ 1.3 MB, mobile ≤ 1.2 MB. Use the reported count as `HERO_FRAME_COUNT` in Step 3. If the counts differ, delete the extra trailing frame from the larger set so they match.

- [ ] **Step 2: Write the failing test**

`frontend/src/utils/frameSequence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  frameIndexForProgress,
  frameSetForWidth,
  frameUrl,
  nearestLoadedFrame,
  placeFrame,
  posterUrl,
} from "./frameSequence";

describe("frameSetForWidth", () => {
  it("uses the mobile set at 768px and below", () => {
    expect(frameSetForWidth(375)).toBe("mobile");
    expect(frameSetForWidth(768)).toBe("mobile");
  });

  it("uses the desktop set above 768px", () => {
    expect(frameSetForWidth(769)).toBe("desktop");
    expect(frameSetForWidth(1440)).toBe("desktop");
  });
});

describe("frameUrl / posterUrl", () => {
  it("builds 1-based, zero-padded frame paths from a 0-based index", () => {
    expect(frameUrl("desktop", 0)).toBe("/hero/desktop/frame-001.webp");
    expect(frameUrl("mobile", 64)).toBe("/hero/mobile/frame-065.webp");
  });

  it("builds poster paths", () => {
    expect(posterUrl("desktop")).toBe("/hero/desktop/poster.webp");
    expect(posterUrl("mobile")).toBe("/hero/mobile/poster.webp");
  });
});

describe("frameIndexForProgress", () => {
  it("maps 0 and 1 to the first and last frame", () => {
    expect(frameIndexForProgress(0, 65)).toBe(0);
    expect(frameIndexForProgress(1, 65)).toBe(64);
  });

  it("rounds to the nearest frame", () => {
    expect(frameIndexForProgress(0.5, 65)).toBe(32);
    expect(frameIndexForProgress(0.51, 11)).toBe(5);
  });

  it("clamps out-of-range and non-finite progress", () => {
    expect(frameIndexForProgress(-0.3, 65)).toBe(0);
    expect(frameIndexForProgress(1.7, 65)).toBe(64);
    expect(frameIndexForProgress(Number.NaN, 65)).toBe(0);
  });

  it("returns 0 when there are no frames", () => {
    expect(frameIndexForProgress(0.5, 0)).toBe(0);
  });
});

describe("nearestLoadedFrame", () => {
  it("returns the target when it is loaded", () => {
    expect(nearestLoadedFrame(2, [false, false, true, false])).toBe(2);
  });

  it("returns the closest loaded frame, preferring the lower one on ties", () => {
    expect(nearestLoadedFrame(2, [false, true, false, true])).toBe(1);
    expect(nearestLoadedFrame(0, [false, false, true])).toBe(2);
  });

  it("clamps targets outside the range", () => {
    expect(nearestLoadedFrame(70, [true, false, false])).toBe(0);
    expect(nearestLoadedFrame(-4, [false, false, true])).toBe(2);
  });

  it("returns null when nothing is loaded", () => {
    expect(nearestLoadedFrame(1, [false, false])).toBeNull();
    expect(nearestLoadedFrame(0, [])).toBeNull();
  });
});

describe("placeFrame", () => {
  it("covers the destination, cropping and centering the overflow", () => {
    expect(placeFrame("cover", 1280, 720, 1280, 1440)).toEqual({ x: -640, y: 0, width: 2560, height: 1440 });
    expect(placeFrame("cover", 1280, 720, 1280, 360)).toEqual({ x: 0, y: -180, width: 1280, height: 720 });
  });

  it("fits the width and anchors to the bottom", () => {
    expect(placeFrame("fit-width-bottom", 540, 720, 375, 812)).toEqual({ x: 0, y: 312, width: 375, height: 500 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/frameSequence.test.ts`
Expected: FAIL — cannot resolve `./frameSequence`.

- [ ] **Step 4: Write the implementation**

`frontend/src/utils/frameSequence.ts` (set `HERO_FRAME_COUNT` to the count from Step 1):

```ts
export type FrameSet = "desktop" | "mobile";
export type FramePlacement = "cover" | "fit-width-bottom";

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HERO_FRAME_COUNT = 65;
export const MOBILE_MAX_WIDTH = 768;

export function frameSetForWidth(width: number): FrameSet {
  return width > MOBILE_MAX_WIDTH ? "desktop" : "mobile";
}

export function frameUrl(set: FrameSet, index: number): string {
  return `/hero/${set}/frame-${String(index + 1).padStart(3, "0")}.webp`;
}

export function posterUrl(set: FrameSet): string {
  return `/hero/${set}/poster.webp`;
}

export function frameIndexForProgress(progress: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  const safe = Number.isFinite(progress) ? progress : 0;
  const clamped = Math.min(1, Math.max(0, safe));
  return Math.round(clamped * (frameCount - 1));
}

// Closest loaded frame to `target`; on a tie the earlier frame wins so a
// half-loaded sequence never jumps ahead of the pour.
export function nearestLoadedFrame(target: number, loaded: ReadonlyArray<boolean>): number | null {
  if (loaded.length === 0) return null;
  const start = Math.min(Math.max(target, 0), loaded.length - 1);
  for (let distance = 0; distance < loaded.length; distance++) {
    if (loaded[start - distance]) return start - distance;
    if (loaded[start + distance]) return start + distance;
  }
  return null;
}

export function placeFrame(
  placement: FramePlacement,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): FrameRect {
  if (placement === "cover") {
    const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight);
    const width = srcWidth * scale;
    const height = srcHeight * scale;
    return { x: (dstWidth - width) / 2, y: (dstHeight - height) / 2, width, height };
  }
  const height = srcHeight * (dstWidth / srcWidth);
  return { x: 0, y: dstHeight - height, width: dstWidth, height };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/frameSequence.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add public/hero src/utils/frameSequence.ts src/utils/frameSequence.test.ts
git commit -m "feat: add hero frame sequences and frame-sequence utilities"
```

---

### Task 2: Motion hooks

**Files:**
- Create: `frontend/src/hooks/usePrefersReducedMotion.ts`, `frontend/src/hooks/useInView.ts`, `frontend/src/hooks/useScrollProgress.ts`
- Test: `frontend/src/hooks/usePrefersReducedMotion.test.tsx`, `frontend/src/hooks/useInView.test.tsx`, `frontend/src/hooks/useScrollProgress.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `usePrefersReducedMotion(): boolean` — `false` when `window.matchMedia` is unavailable
  - `useInView(ref: RefObject<Element>, threshold?: number): boolean` — default threshold `0.25`; latches `true`; `true` immediately when `IntersectionObserver` is unavailable
  - `scrollProgress(input: { top: number; height: number; viewportHeight: number }): number`
  - `useScrollProgress(ref: RefObject<HTMLElement>, onProgress: (progress: number) => void, enabled?: boolean): void` — default `enabled = true`; calls `onProgress` once on mount and then at most once per animation frame on scroll/resize

- [ ] **Step 1: Write the failing tests**

`frontend/src/hooks/usePrefersReducedMotion.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubMatchMedia(matches: boolean) {
  let listener: ((event: { matches: boolean }) => void) | null = null;
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((media: string) => ({
      matches,
      media,
      addEventListener: (_type: string, handler: (event: { matches: boolean }) => void) => {
        listener = handler;
      },
      removeEventListener: vi.fn(),
    }))
  );
  return (next: boolean) => listener?.({ matches: next });
}

describe("usePrefersReducedMotion", () => {
  it("reflects the current preference", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("updates when the preference changes", () => {
    const emit = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => emit(true));
    expect(result.current).toBe(true);
  });

  it("returns false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

`frontend/src/hooks/useInView.test.tsx`:

```tsx
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
```

`frontend/src/hooks/useScrollProgress.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { scrollProgress, useScrollProgress } from "./useScrollProgress";

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
});
```

(The first `useScrollProgress` test mounts disabled, installs the fake `getBoundingClientRect`, then enables — so the first measurement uses the mocked rect.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks`
Expected: FAIL — the three hook modules cannot be resolved.

- [ ] **Step 3: Write the implementations**

`frontend/src/hooks/usePrefersReducedMotion.ts`:

```ts
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function currentPreference(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(currentPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(QUERY);
    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return reduced;
}
```

`frontend/src/hooks/useInView.ts`:

```ts
import { useEffect, useState, type RefObject } from "react";

export function useInView(ref: RefObject<Element>, threshold = 0.25): boolean {
  // Without IntersectionObserver there is nothing to wait for, so content shows immediately.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (inView || !element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, inView, threshold]);

  return inView;
}
```

`frontend/src/hooks/useScrollProgress.ts`:

```ts
import { useEffect, useRef, type RefObject } from "react";

// Progress of an element through the part of its height that extends past the
// viewport — i.e. how far a sticky child pinned inside it has been scrubbed.
export function scrollProgress({ top, height, viewportHeight }: { top: number; height: number; viewportHeight: number }): number {
  const range = height - viewportHeight;
  if (range <= 0) return top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / range));
}

export function useScrollProgress(
  ref: RefObject<HTMLElement>,
  onProgress: (progress: number) => void,
  enabled = true
): void {
  const callbackRef = useRef(onProgress);

  useEffect(() => {
    callbackRef.current = onProgress;
  });

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      callbackRef.current(scrollProgress({ top: rect.top, height: rect.height, viewportHeight: window.innerHeight }));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks`
Expected: PASS (all three files).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePrefersReducedMotion.ts src/hooks/usePrefersReducedMotion.test.tsx src/hooks/useInView.ts src/hooks/useInView.test.tsx src/hooks/useScrollProgress.ts src/hooks/useScrollProgress.test.tsx
git commit -m "feat: add reduced-motion, in-view, and scroll-progress hooks"
```

---

### Task 3: Theme tokens, overlay header, and PageShell home mode

**Files:**
- Modify: `frontend/src/theme/themes.css`, `frontend/tailwind.config.js`, `frontend/src/index.css.test.js`
- Modify: `frontend/src/components/layout/Header.tsx`, `frontend/src/components/layout/Header.test.tsx`
- Modify: `frontend/src/components/layout/PageShell.tsx`
- Create: `frontend/src/components/layout/PageShell.test.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - CSS variables `--color-wine-red`, `--color-wine-white`, `--color-wine-rose` (per theme) and `--color-cellar-bg`, `--color-cellar-ink`, `--color-cellar-muted` (shared)
  - Tailwind colors `wine-red`, `wine-white`, `wine-rose`, `cellar-bg`, `cellar-ink`, `cellar-muted` (so `fill-wine-red`, `stroke-wine-red`, `bg-cellar-bg`, `text-cellar-ink`, etc. exist)
  - `Header({ overlay?: boolean })`
  - `PageShell` renders `<a href="#all-features">Skip to all features</a>` first and `<Header overlay />` on `/`

- [ ] **Step 1: Write the failing tests**

Append to the variable list in `frontend/src/index.css.test.js` (inside the existing `for (const variable of [...])` array, after `"--color-accent",`):

```js
      "--color-wine-red",
      "--color-wine-white",
      "--color-wine-rose",
      "--color-cellar-bg",
      "--color-cellar-ink",
      "--color-cellar-muted",
```

Replace `frontend/src/components/layout/Header.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";

function renderHeader(overlay?: boolean) {
  render(
    <MemoryRouter>
      <Header overlay={overlay} />
    </MemoryRouter>
  );
}

describe("Header", () => {
  it("renders an Admin link pointing to /admin", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("href", "/admin");
  });

  it("renders a bordered, in-flow header by default", () => {
    renderHeader();
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("border-b");
    expect(header).not.toHaveClass("absolute");
  });

  it("renders a transparent header positioned over the page when overlay is set", () => {
    renderHeader(true);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("absolute", "inset-x-0", "top-0");
    expect(header).not.toHaveClass("border-b");
    expect(screen.getByRole("link", { name: "VinoScope" })).toHaveClass("text-cellar-ink");
  });
});
```

Create `frontend/src/components/layout/PageShell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageShell } from "./PageShell";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageShell>
        <p>Page content</p>
      </PageShell>
    </MemoryRouter>
  );
}

describe("PageShell", () => {
  it("on the home route, renders the skip link first, an overlay header, and a full-width main", () => {
    renderAt("/");
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Skip to all features");
    expect(links[0]).toHaveAttribute("href", "#all-features");
    expect(screen.getByRole("banner")).toHaveClass("absolute");
    expect(screen.getByRole("main")).not.toHaveClass("max-w-6xl");
  });

  it("on other routes, renders no skip link, a normal header, and a contained main", () => {
    renderAt("/pair");
    expect(screen.queryByText("Skip to all features")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).not.toHaveClass("absolute");
    expect(screen.getByRole("main")).toHaveClass("max-w-6xl");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/index.css.test.js src/components/layout`
Expected: FAIL — missing CSS variables, `overlay` classes absent, no skip link.

- [ ] **Step 3: Add theme tokens**

In `frontend/src/theme/themes.css`, add these lines at the end of each theme block (before its closing `}`):

In the `:root, [data-theme="dark-burgundy"]` block:

```css
  --color-wine-red: #8e1b2e;
  --color-wine-white: #d9c27a;
  --color-wine-rose: #d98a8f;
```

In the `[data-theme="cream-terracotta"]` block:

```css
  --color-wine-red: #7a1426;
  --color-wine-white: #b8952f;
  --color-wine-rose: #c4666f;
```

In the `[data-theme="charcoal-gold"]` block:

```css
  --color-wine-red: #9b2335;
  --color-wine-white: #e0c97f;
  --color-wine-rose: #e09aa0;
```

Then append a new block at the end of the file:

```css
/* The home hero is an always-dark "cellar" band in every theme. */
:root {
  --color-cellar-bg: #0b0506;
  --color-cellar-ink: #f3e9da;
  --color-cellar-muted: #c9b8a8;
}
```

In `frontend/tailwind.config.js`, extend `colors` (after `accent: "var(--color-accent)",`):

```js
        "wine-red": "var(--color-wine-red)",
        "wine-white": "var(--color-wine-white)",
        "wine-rose": "var(--color-wine-rose)",
        "cellar-bg": "var(--color-cellar-bg)",
        "cellar-ink": "var(--color-cellar-ink)",
        "cellar-muted": "var(--color-cellar-muted)",
```

- [ ] **Step 4: Add the Header overlay prop**

Replace `frontend/src/components/layout/Header.tsx` with:

```tsx
import { NavLink } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/pair", label: "Pair" },
  { to: "/compare", label: "Compare" },
  { to: "/learn", label: "Learn" },
];

export function Header({ overlay = false }: { overlay?: boolean }) {
  // Overlay mode sits on the home page's always-dark hero, so it uses the
  // theme-independent cellar colors instead of the theme's ink.
  const headerClass = overlay ? "absolute inset-x-0 top-0 z-20" : "border-b border-surface-border";
  const brandClass = overlay ? "text-cellar-ink" : "text-ink";
  const idleLinkClass = overlay ? "text-cellar-muted hover:text-cellar-ink" : "text-ink-muted hover:text-ink";

  return (
    <header className={headerClass}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <NavLink to="/" className={`font-serif text-lg tracking-wide ${brandClass}`}>
          VinoScope
        </NavLink>
        <nav className="flex items-center gap-4 text-sm flex-wrap">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "text-accent" : idleLinkClass)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <NavLink
            to="/admin"
            className={({ isActive }) => `text-sm ${isActive ? "text-accent" : idleLinkClass}`}
          >
            Admin
          </NavLink>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Add PageShell home mode**

Replace `frontend/src/components/layout/PageShell.tsx` with:

```tsx
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  const isHome = useLocation().pathname === "/";

  return (
    <div className="relative min-h-screen flex flex-col bg-surface text-ink">
      {isHome && (
        <a
          href="#all-features"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded focus:bg-cellar-bg focus:px-4 focus:py-2 focus:text-cellar-ink"
        >
          Skip to all features
        </a>
      )}
      <Header overlay={isHome} />
      <main className={isHome ? "flex-1 w-full" : "flex-1 max-w-6xl w-full mx-auto px-4 py-8"}>{children}</main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 6: Prepare App.test for the new home page**

The new home page (Task 8) calls `listWines` and reads `matchMedia`. Make `App.test.tsx` deterministic now. Replace its imports and add setup so the file starts like this (keep every existing `describe`/`it` unchanged below it):

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import * as api from "./services/api";

vi.mock("./services/api", async () => {
  const actual = await vi.importActual<typeof import("./services/api")>("./services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((media: string) => ({
      matches: media === "(prefers-reduced-motion: reduce)",
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/index.css.test.js src/components/layout src/App.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS (no regressions in other pages).

- [ ] **Step 9: Commit**

```bash
git add src/theme/themes.css tailwind.config.js src/index.css.test.js src/components/layout src/App.test.tsx
git commit -m "feat: add wine/cellar tokens, overlay header, and PageShell home mode"
```

---

### Task 4: Scene shell, animation stylesheet, and glass art

**Files:**
- Create: `frontend/src/components/home/home.css`
- Create: `frontend/src/components/home/art/cssVars.ts`
- Create: `frontend/src/components/home/art/Glass.tsx`
- Create: `frontend/src/components/home/Scene.tsx`
- Test: `frontend/src/components/home/Scene.test.tsx`

**Interfaces:**
- Consumes: `usePrefersReducedMotion(): boolean`, `useInView(ref, threshold?): boolean` (Task 2); Tailwind colors from Task 3.
- Produces:
  - `cssVars(vars: Record<\`--${string}\`, string>): CSSProperties`
  - `type WineColor = "red" | "white" | "rose"`, `type FillLevel = "low" | "mid" | "high"`
  - `Glass({ wine: WineColor; level: FillLevel; surfaceClassName?: string })` — returns an SVG `<g>` in a `0 0 200 220` coordinate space (bowl x≈55–145, y 20–135; stem to y 195; base at y 198)
  - `Scene({ id: string; index: number; label: string; title: string; side: "left" | "right"; art: ReactNode; children: ReactNode })` — renders `<section id aria-labelledby={`${id}-title`}>` with an `<h2 id={`${id}-title`}>`
  - `SceneCta({ to: string; children: ReactNode })`
  - CSS classes for scene art: `draw`, `pop`, `fan` (uses `--fan`), `slide` (uses `--from-x`), `meter-fill` (uses `--value`), `fade-out`, `radar-a`, `radar-b`, `swirl`; all honor `--delay`

- [ ] **Step 1: Write the failing test**

`frontend/src/components/home/Scene.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Scene, SceneCta } from "./Scene";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

function stubIntersectionObserver() {
  const callbacks: IntersectionObserverCallback[] = [];
  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      callbacks.push(callback);
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return callbacks;
}

function renderScene(side: "left" | "right" = "left") {
  return render(
    <MemoryRouter>
      <Scene id="discover" index={2} label="Discover" title="Find your wine profile." side={side} art={<svg data-testid="art-svg" />}>
        <p>Body copy</p>
        <SceneCta to="/discover">Find Your Profile</SceneCta>
      </Scene>
    </MemoryRouter>
  );
}

describe("Scene", () => {
  it("renders a labelled section with its label, heading, body, and CTA", () => {
    renderScene();
    const section = screen.getByRole("region", { name: "Find your wine profile." });
    expect(section).toHaveAttribute("id", "discover");
    expect(screen.getByText("02 · Discover")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Find your wine profile." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find Your Profile" })).toHaveAttribute("href", "/discover");
  });

  it("hides the art from assistive technology", () => {
    renderScene();
    expect(screen.getByTestId("scene-art")).toHaveAttribute("aria-hidden", "true");
  });

  it("adds is-visible once the scene intersects the viewport", () => {
    stubReducedMotion(false);
    const callbacks = stubIntersectionObserver();
    renderScene();
    const section = screen.getByRole("region", { name: "Find your wine profile." });
    expect(section).toHaveClass("scene-animate");
    expect(section).not.toHaveClass("is-visible");
    act(() => {
      callbacks[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(section).toHaveClass("is-visible");
  });

  it("omits scene-animate under reduced motion so the final state renders", () => {
    stubReducedMotion(true);
    stubIntersectionObserver();
    renderScene();
    expect(screen.getByRole("region", { name: "Find your wine profile." })).not.toHaveClass("scene-animate");
  });

  it("moves the art to the right column only for right-side scenes", () => {
    const { unmount } = renderScene("right");
    expect(screen.getByTestId("scene-art")).toHaveClass("md:order-last");
    unmount();
    renderScene("left");
    expect(screen.getByTestId("scene-art")).not.toHaveClass("md:order-last");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/Scene.test.tsx`
Expected: FAIL — cannot resolve `./Scene`.

- [ ] **Step 3: Write the stylesheet**

`frontend/src/components/home/home.css`:

```css
/*
 * Home scene animation. Every rule outside `.scene-animate:not(.is-visible)`
 * describes the finished (resting) look, so reduced motion, no JS, and no
 * IntersectionObserver all show complete scenes.
 */

.scene .draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 1.2s ease var(--delay, 0s);
}

.scene .pop,
.scene .fan,
.scene .slide,
.scene .swirl {
  transform-box: fill-box;
}

.scene .pop {
  transform-origin: center;
  transition: opacity 0.6s ease var(--delay, 0s), transform 0.6s ease var(--delay, 0s);
}

.scene .fan {
  transform-origin: 50% 100%;
  transform: rotate(var(--fan, 0deg));
  transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) var(--delay, 0s), opacity 0.6s ease var(--delay, 0s);
}

.scene .slide {
  transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) var(--delay, 0s), opacity 0.6s ease var(--delay, 0s);
}

.scene .meter-fill {
  transform-origin: left center;
  transform: scaleX(var(--value, 1));
  transition: transform 1s ease var(--delay, 0s);
}

.scene .fade-out {
  opacity: 0.12;
  transition: opacity 1.2s ease var(--delay, 0s);
}

.scene .radar-a {
  opacity: 0;
  transition: opacity 0.8s ease var(--delay, 0s);
}

.scene .radar-b {
  opacity: 1;
  transition: opacity 0.8s ease var(--delay, 0s);
}

.scene-animate:not(.is-visible) .draw {
  stroke-dashoffset: 1;
}

.scene-animate:not(.is-visible) .pop {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

.scene-animate:not(.is-visible) .fan {
  opacity: 0;
  transform: rotate(0deg);
}

.scene-animate:not(.is-visible) .slide {
  opacity: 0;
  transform: translateX(var(--from-x, 0px));
}

.scene-animate:not(.is-visible) .meter-fill {
  transform: scaleX(0);
}

.scene-animate:not(.is-visible) .fade-out,
.scene-animate:not(.is-visible) .radar-a {
  opacity: 1;
}

.scene-animate:not(.is-visible) .radar-b {
  opacity: 0;
}

.scene-animate.is-visible .swirl {
  transform-origin: center;
  animation: scene-swirl 1.4s ease-in-out var(--delay, 0s) 2;
}

@keyframes scene-swirl {
  0%,
  100% {
    transform: none;
  }
  25% {
    transform: skewY(5deg) translateY(-2px);
  }
  75% {
    transform: skewY(-5deg) translateY(2px);
  }
}
```

- [ ] **Step 4: Write the art helpers**

`frontend/src/components/home/art/cssVars.ts`:

```ts
import type { CSSProperties } from "react";

// React's CSSProperties has no index signature for custom properties.
export function cssVars(vars: Record<`--${string}`, string>): CSSProperties {
  return vars as CSSProperties;
}
```

`frontend/src/components/home/art/Glass.tsx`:

```tsx
import { useId } from "react";
import { cssVars } from "./cssVars";

export type WineColor = "red" | "white" | "rose";
export type FillLevel = "low" | "mid" | "high";

const BOWL = "M60 20 C55 80 60 120 100 135 C140 120 145 80 140 20";
const LEVEL_Y: Record<FillLevel, number> = { low: 100, mid: 82, high: 64 };
const WINE_FILL: Record<WineColor, string> = { red: "fill-wine-red", white: "fill-wine-white", rose: "fill-wine-rose" };
const WINE_STROKE: Record<WineColor, string> = { red: "stroke-wine-red", white: "stroke-wine-white", rose: "stroke-wine-rose" };

// Gold line-art wine glass in a 200×220 coordinate space. The outline draws
// in, then the wine fades up inside a clip of the bowl.
export function Glass({ wine, level, surfaceClassName = "" }: { wine: WineColor; level: FillLevel; surfaceClassName?: string }) {
  const clipId = `glass-bowl-${useId().replace(/:/g, "")}`;
  const y = LEVEL_Y[level];

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={`${BOWL} Z`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} className="pop" style={cssVars({ "--delay": "0.9s" })}>
        <rect x="40" y={y} width="120" height={140 - y} className={WINE_FILL[wine]} fillOpacity="0.85" />
        <path
          className={`${WINE_STROKE[wine]} ${surfaceClassName}`}
          d={`M52 ${y} Q100 ${y + 7} 148 ${y}`}
          fill="none"
          strokeWidth="2"
        />
      </g>
      <path className="draw stroke-accent" pathLength={1} d={BOWL} fill="none" strokeWidth="1.6" strokeLinecap="round" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.3s" })}
        d="M100 135 V195"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.5s" })}
        d="M70 198 H130"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  );
}
```

- [ ] **Step 5: Write the Scene component**

`frontend/src/components/home/Scene.tsx`:

```tsx
import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useInView } from "../../hooks/useInView";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import "./home.css";

interface SceneProps {
  id: string;
  index: number;
  label: string;
  title: string;
  side: "left" | "right";
  art: ReactNode;
  children: ReactNode;
}

export function Scene({ id, index, label, title, side, art, children }: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(ref);
  const titleId = `${id}-title`;

  const classes = ["scene grid items-center gap-10 py-20 md:min-h-[130vh] md:grid-cols-2"];
  if (!reducedMotion) classes.push("scene-animate");
  if (inView) classes.push("is-visible");

  return (
    <section ref={ref} id={id} aria-labelledby={titleId} data-side={side} className={classes.join(" ")}>
      <div data-testid="scene-art" aria-hidden="true" className={side === "right" ? "md:order-last" : undefined}>
        {art}
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">
          {String(index).padStart(2, "0")} · {label}
        </p>
        <h2 id={titleId} className="font-serif text-3xl md:text-4xl text-ink mb-4">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function SceneCta({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-block border border-accent text-accent font-semibold px-5 py-2.5 rounded hover:bg-accent hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/home/Scene.test.tsx`
Expected: PASS.

- [ ] **Step 7: Type-check**

Run: `npx tsc -b`
Expected: no errors (`Glass`/`cssVars` compile even though no scene uses them yet — they are exported).

- [ ] **Step 8: Commit**

```bash
git add src/components/home
git commit -m "feat: add home Scene shell, scene animation styles, and line-art glass"
```

---

### Task 5: HeroPour

**Files:**
- Create: `frontend/src/components/home/HeroPour.tsx`
- Test: `frontend/src/components/home/HeroPour.test.tsx`

**Interfaces:**
- Consumes: `usePrefersReducedMotion()`, `useScrollProgress(ref, onProgress, enabled)` (Task 2); everything from `utils/frameSequence.ts` (Task 1); Tailwind `cellar-*` colors (Task 3).
- Produces: `HeroPour()` — a fragment containing the hero `<section aria-labelledby="hero-title">` (with `<h1 id="hero-title">`) followed by a decorative 30vh cellar→surface gradient `<div>`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/home/HeroPour.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/HeroPour.test.tsx`
Expected: FAIL — cannot resolve `./HeroPour`.

- [ ] **Step 3: Write the implementation**

`frontend/src/components/home/HeroPour.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useScrollProgress } from "../../hooks/useScrollProgress";
import {
  HERO_FRAME_COUNT,
  frameIndexForProgress,
  frameSetForWidth,
  frameUrl,
  nearestLoadedFrame,
  placeFrame,
  posterUrl,
  type FrameSet,
} from "../../utils/frameSequence";

const PRELOAD_CONCURRENCY = 8;
const CUE_HIDE_PROGRESS = 0.05;
const MAX_PIXEL_RATIO = 2;
const MEDIA_LABEL = "Red wine being poured into a glass";

function HeroCopy({ showCue }: { showCue: boolean }) {
  return (
    <div className="relative z-10 h-full max-w-6xl mx-auto px-4 pt-24 flex flex-col justify-start md:pt-0 md:justify-center">
      <div className="max-w-md">
        <h1 id="hero-title" className="font-serif text-4xl md:text-5xl text-cellar-ink mb-4">
          Find a wine you'll actually enjoy.
        </h1>
        <p className="text-cellar-muted mb-6">
          Browse a real catalog by type, country, grape, and price — then let VinoScope help you choose.
        </p>
        <Link
          to="/explore"
          className="inline-block bg-accent text-surface font-semibold px-6 py-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cellar-ink"
        >
          Explore Wines
        </Link>
      </div>
      {showCue && (
        <p aria-hidden="true" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-cellar-muted">
          Scroll
        </p>
      )}
    </div>
  );
}

function posterClass(frameSet: FrameSet): string {
  return `absolute inset-0 h-full w-full ${frameSet === "desktop" ? "object-cover" : "object-contain object-bottom"}`;
}

const CELLAR_FADE = (
  <div aria-hidden="true" className="h-[30vh] bg-gradient-to-b from-cellar-bg to-surface" />
);

export function HeroPour() {
  const reducedMotion = usePrefersReducedMotion();
  // Chosen once so a resize never triggers a second download of the other set.
  const [frameSet] = useState<FrameSet>(() => frameSetForWidth(window.innerWidth));
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<(HTMLImageElement | null)[]>([]);
  const targetFrameRef = useRef(0);
  const drawnFrameRef = useRef(-1);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showCue, setShowCue] = useState(true);

  const draw = useCallback(
    (force = false) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const frames = framesRef.current;
      const index = nearestLoadedFrame(targetFrameRef.current, frames.map(Boolean));
      if (index === null || (!force && index === drawnFrameRef.current)) return;
      const image = frames[index];
      if (!image) return;
      const rect = placeFrame(
        frameSet === "desktop" ? "cover" : "fit-width-bottom",
        image.naturalWidth,
        image.naturalHeight,
        canvas.width,
        canvas.height
      );
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      drawnFrameRef.current = index;
    },
    [frameSet]
  );

  useScrollProgress(
    sectionRef,
    (progress) => {
      targetFrameRef.current = frameIndexForProgress(progress, HERO_FRAME_COUNT);
      setShowCue(progress < CUE_HIDE_PROGRESS);
      draw();
    },
    !reducedMotion
  );

  // Keep the canvas backing store matched to its CSS size.
  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      draw(true);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [reducedMotion, draw]);

  // Preload frames in order, a few at a time; the poster covers the gap.
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    let next = 0;
    const frames: (HTMLImageElement | null)[] = new Array(HERO_FRAME_COUNT).fill(null);
    framesRef.current = frames;

    const loadNext = () => {
      if (cancelled || next >= HERO_FRAME_COUNT) return;
      const index = next++;
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (cancelled) return;
        frames[index] = image;
        if (index === 0 && canvasRef.current?.getContext("2d")) setCanvasReady(true);
        draw();
        loadNext();
      };
      image.onerror = () => loadNext();
      image.src = frameUrl(frameSet, index);
    };

    for (let i = 0; i < PRELOAD_CONCURRENCY; i++) loadNext();
    return () => {
      cancelled = true;
    };
  }, [reducedMotion, frameSet, draw]);

  const poster = (
    <img src={posterUrl(frameSet)} alt="" className={posterClass(frameSet)} decoding="async" />
  );

  if (reducedMotion) {
    return (
      <>
        <section aria-labelledby="hero-title" className="relative h-screen overflow-hidden bg-cellar-bg">
          <div role="img" aria-label={MEDIA_LABEL} className="absolute inset-0">
            {poster}
          </div>
          <HeroCopy showCue={false} />
        </section>
        {CELLAR_FADE}
      </>
    );
  }

  return (
    <>
      <section ref={sectionRef} aria-labelledby="hero-title" className="relative h-[250vh] bg-cellar-bg">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div role="img" aria-label={MEDIA_LABEL} className="absolute inset-0">
            {poster}
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${canvasReady ? "opacity-100" : "opacity-0"}`}
            />
          </div>
          <HeroCopy showCue={showCue} />
        </div>
      </section>
      {CELLAR_FADE}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/HeroPour.test.tsx`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc -b`
Expected: no errors.

```bash
git add src/components/home/HeroPour.tsx src/components/home/HeroPour.test.tsx
git commit -m "feat: add scroll-scrubbed HeroPour with reduced-motion poster fallback"
```

---

### Task 6: Explore scene with live wines

**Files:**
- Create: `frontend/src/components/home/scenes/ExploreScene.tsx`
- Test: `frontend/src/components/home/scenes/ExploreScene.test.tsx`

**Interfaces:**
- Consumes: `Scene`, `SceneCta` (Task 4); `Glass`, `cssVars` (Task 4); `listWines(params: ListWinesParams): Promise<WineListResponse>` from `services/api`; `formatPrice(price: number | null, currency: string | null): string` from `utils/format`; `WineListItem` from `types/wine`.
- Produces: `ExploreScene()` — section `id="explore"`, title "Wander the whole cellar.", CTA "Explore Wines" → `/explore`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/home/scenes/ExploreScene.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExploreScene } from "./ExploreScene";
import * as api from "../../../services/api";
import type { WineListItem } from "../../../types/wine";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

function makeWine(id: number, overrides: Partial<WineListItem> = {}): WineListItem {
  return {
    id,
    name: `Wine ${id}`,
    winery: "Test Winery",
    vintage: 2020,
    type: "red",
    country: "France",
    region: null,
    grapes: [],
    price: 20,
    currency: "USD",
    price_usd_approx: null,
    image_url: null,
    sweetness: null,
    acidity: null,
    tannin: null,
    body: null,
    fruitiness: null,
    ...overrides,
  };
}

function renderScene() {
  return render(
    <MemoryRouter>
      <ExploreScene />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(api.listWines).mockReset();
});

describe("ExploreScene", () => {
  it("requests three wines", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(api.listWines).toHaveBeenCalledWith({ limit: 3 });
  });

  it("shows three skeleton rows while loading", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(screen.getAllByTestId("wine-skeleton")).toHaveLength(3);
  });

  it("shows up to three linked wines with type, country, and price", async () => {
    vi.mocked(api.listWines).mockResolvedValue({
      total: 4,
      items: [makeWine(1), makeWine(2, { type: "white", country: "Italy", price: 14.5 }), makeWine(3), makeWine(4)],
    });
    renderScene();
    const link = await screen.findByRole("link", { name: /Wine 2/ });
    expect(link).toHaveAttribute("href", "/wines/2");
    expect(link).toHaveTextContent("white · Italy");
    expect(link).toHaveTextContent("$14.50");
    expect(screen.queryByRole("link", { name: /Wine 4/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("wine-skeleton")).not.toBeInTheDocument();
  });

  it("falls back to descriptive copy when the request fails", async () => {
    vi.mocked(api.listWines).mockRejectedValue(new Error("offline"));
    renderScene();
    expect(await screen.findByText("Hundreds of wines by type, country, grape and price.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("wine-skeleton")).not.toBeInTheDocument());
  });

  it("falls back to descriptive copy when no wines come back", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
    renderScene();
    expect(await screen.findByText("Hundreds of wines by type, country, grape and price.")).toBeInTheDocument();
  });

  it("always offers the Explore CTA", () => {
    vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
    renderScene();
    expect(screen.getByRole("link", { name: "Explore Wines" })).toHaveAttribute("href", "/explore");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/scenes/ExploreScene.test.tsx`
Expected: FAIL — cannot resolve `./ExploreScene`.

- [ ] **Step 3: Write the implementation**

`frontend/src/components/home/scenes/ExploreScene.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listWines } from "../../../services/api";
import type { WineListItem } from "../../../types/wine";
import { formatPrice } from "../../../utils/format";
import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const SAMPLE_SIZE = 3;
const FALLBACK_COPY = "Hundreds of wines by type, country, grape and price.";

type WinesState = { status: "loading" } | { status: "loaded"; wines: WineListItem[] } | { status: "error" };

function Bottle() {
  return (
    <path
      className="stroke-accent"
      fill="none"
      strokeWidth="1.2"
      strokeLinejoin="round"
      d="M-6 0 H6 V22 Q16 30 16 44 V120 H-16 V44 Q-16 30 -6 22 Z"
    />
  );
}

function ExploreArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-sm mx-auto" focusable="false">
      <g transform="translate(58 80) scale(0.8)">
        <g className="fan" style={cssVars({ "--fan": "-14deg", "--delay": "0.6s" })}>
          <Bottle />
        </g>
      </g>
      <g transform="translate(100 70) scale(0.8)">
        <g className="fan" style={cssVars({ "--fan": "0deg", "--delay": "0.75s" })}>
          <Bottle />
        </g>
      </g>
      <g transform="translate(142 80) scale(0.8)">
        <g className="fan" style={cssVars({ "--fan": "14deg", "--delay": "0.9s" })}>
          <Bottle />
        </g>
      </g>
      <Glass wine="red" level="mid" />
    </svg>
  );
}

function WineRows({ state }: { state: WinesState }) {
  if (state.status === "loading") {
    return (
      <ul className="grid gap-2 mb-6" aria-busy="true">
        {Array.from({ length: SAMPLE_SIZE }, (_, i) => (
          <li key={i} data-testid="wine-skeleton" className="h-14 rounded border border-surface-border" />
        ))}
      </ul>
    );
  }

  if (state.status === "error" || state.wines.length === 0) {
    return <p className="text-ink-muted mb-6">{FALLBACK_COPY}</p>;
  }

  return (
    <ul className="grid gap-2 mb-6">
      {state.wines.map((wine, i) => (
        <li key={wine.id} className="pop" style={cssVars({ "--delay": `${0.8 + i * 0.15}s` })}>
          <Link
            to={`/wines/${wine.id}`}
            className="flex items-center justify-between gap-4 rounded border border-surface-border px-4 py-3 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span>
              <span className="block text-ink">{wine.name}</span>
              <span className="block text-sm text-ink-muted">
                {wine.type}
                {wine.country ? ` · ${wine.country}` : ""}
              </span>
            </span>
            <span className="text-sm text-ink whitespace-nowrap">{formatPrice(wine.price, wine.currency)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ExploreScene() {
  const [state, setState] = useState<WinesState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    listWines({ limit: SAMPLE_SIZE })
      .then((response) => {
        if (active) setState({ status: "loaded", wines: response.items.slice(0, SAMPLE_SIZE) });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Scene id="explore" index={1} label="Explore" title="Wander the whole cellar." side="left" art={<ExploreArt />}>
      <p className="text-ink-muted mb-6">
        Browse a real catalog by type, country, grape, and price — every wine with a full detail page and
        links to retailers.
      </p>
      <WineRows state={state} />
      <SceneCta to="/explore">Explore Wines</SceneCta>
    </Scene>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/scenes/ExploreScene.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/scenes/ExploreScene.tsx src/components/home/scenes/ExploreScene.test.tsx
git commit -m "feat: add Explore scene with live catalog sample"
```

---

### Task 7: Discover, Pair, Compare, and Learn scenes

**Files:**
- Create: `frontend/src/components/home/scenes/DiscoverScene.tsx`
- Create: `frontend/src/components/home/scenes/PairScene.tsx`
- Create: `frontend/src/components/home/scenes/CompareScene.tsx`
- Create: `frontend/src/components/home/scenes/LearnScene.tsx`
- Test: `frontend/src/components/home/scenes/FeatureScenes.test.tsx`

**Interfaces:**
- Consumes: `Scene`, `SceneCta`, `Glass`, `cssVars` (Task 4); `FOOD_PAIRINGS: Record<FoodKey, { label: string; … }>` from `constants/foodPairings`.
- Produces:
  - `DiscoverScene()` — `id="discover"`, index 2, side right, title "Find your wine profile.", CTA "Find Your Profile" → `/discover`
  - `PairScene()` — `id="pair"`, index 3, side left, title "Match the bottle to the plate.", CTA "Pair With Food" → `/pair`
  - `CompareScene()` — `id="compare"`, index 4, side right, title "Taste two wines side by side.", CTA "Compare Wines" → `/compare`
  - `LearnScene()` — `id="learn"`, index 5, side left, title "Learn what's in your glass.", CTA "Start Learning" → `/learn`

- [ ] **Step 1: Write the failing test**

`frontend/src/components/home/scenes/FeatureScenes.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ComponentType } from "react";
import { DiscoverScene } from "./DiscoverScene";
import { PairScene } from "./PairScene";
import { CompareScene } from "./CompareScene";
import { LearnScene } from "./LearnScene";

const CASES: { name: string; Component: ComponentType; title: string; cta: string; href: string; side: string }[] = [
  { name: "Discover", Component: DiscoverScene, title: "Find your wine profile.", cta: "Find Your Profile", href: "/discover", side: "right" },
  { name: "Pair", Component: PairScene, title: "Match the bottle to the plate.", cta: "Pair With Food", href: "/pair", side: "left" },
  { name: "Compare", Component: CompareScene, title: "Taste two wines side by side.", cta: "Compare Wines", href: "/compare", side: "right" },
  { name: "Learn", Component: LearnScene, title: "Learn what's in your glass.", cta: "Start Learning", href: "/learn", side: "left" },
];

function renderScene(Component: ComponentType) {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  );
}

describe.each(CASES)("$name scene", ({ Component, title, cta, href, side }) => {
  it("renders its heading, CTA, side, and hidden art", () => {
    renderScene(Component);
    const section = screen.getByRole("region", { name: title });
    expect(section).toHaveAttribute("data-side", side);
    expect(screen.getByRole("link", { name: cta })).toHaveAttribute("href", href);
    expect(screen.getByTestId("scene-art").querySelector("svg")).not.toBeNull();
  });
});

describe("DiscoverScene", () => {
  it("shows the five taste dimensions with their sample values", () => {
    renderScene(DiscoverScene);
    for (const [label, percent] of [
      ["Body", "70%"],
      ["Tannin", "55%"],
      ["Acidity", "60%"],
      ["Sweetness", "20%"],
      ["Fruitiness", "65%"],
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(percent)).toBeInTheDocument();
    }
  });
});

describe("PairScene", () => {
  it("shows food chips from the shared pairing labels", () => {
    renderScene(PairScene);
    expect(screen.getByText("Steak")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
    expect(screen.getByText("Aged cheese")).toBeInTheDocument();
  });
});

describe("LearnScene", () => {
  it("sets expectations that the guide is still coming", () => {
    renderScene(LearnScene);
    expect(screen.getByText(/the Learn guide is being poured now/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/scenes/FeatureScenes.test.tsx`
Expected: FAIL — scene modules cannot be resolved.

- [ ] **Step 3: Write DiscoverScene**

`frontend/src/components/home/scenes/DiscoverScene.tsx`:

```tsx
import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const SAMPLE_PROFILE: ReadonlyArray<readonly [label: string, value: number]> = [
  ["Body", 0.7],
  ["Tannin", 0.55],
  ["Acidity", 0.6],
  ["Sweetness", 0.2],
  ["Fruitiness", 0.65],
];

function DiscoverArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-sm mx-auto" focusable="false">
      <Glass wine="red" level="mid" surfaceClassName="swirl" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "1.2s" })}
        d="M30 60 q6 -8 12 0 M158 110 q6 -8 12 0"
        fill="none"
        strokeWidth="0.8"
      />
    </svg>
  );
}

export function DiscoverScene() {
  return (
    <Scene id="discover" index={2} label="Discover" title="Find your wine profile." side="right" art={<DiscoverArt />}>
      <p className="text-ink-muted mb-6">
        Answer a few questions about what you like and we map your taste — then match it against every wine in
        the catalog.
      </p>
      <dl className="grid gap-2 mb-6 max-w-xs">
        {SAMPLE_PROFILE.map(([label, value], i) => (
          <div key={label} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="h-1.5 rounded bg-surface-border overflow-hidden">
              <span
                className="meter-fill block h-full bg-accent"
                style={cssVars({ "--value": String(value), "--delay": `${0.4 + i * 0.12}s` })}
              />
            </dd>
            <dd className="text-ink-muted text-right">{Math.round(value * 100)}%</dd>
          </div>
        ))}
      </dl>
      <SceneCta to="/discover">Find Your Profile</SceneCta>
    </Scene>
  );
}
```

- [ ] **Step 4: Write PairScene**

`frontend/src/components/home/scenes/PairScene.tsx`:

```tsx
import { FOOD_PAIRINGS, type FoodKey } from "../../../constants/foodPairings";
import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const SAMPLE_FOODS: FoodKey[] = ["steak", "salmon", "aged_cheese"];

function PairArt() {
  return (
    <svg viewBox="0 0 260 220" className="w-full max-w-md mx-auto" focusable="false">
      <Glass wine="red" level="mid" />
      <g className="slide" style={cssVars({ "--from-x": "40px", "--delay": "0.7s" })}>
        <ellipse cx="205" cy="172" rx="46" ry="13" className="stroke-accent" fill="none" strokeWidth="1.4" />
        <ellipse cx="205" cy="170" rx="30" ry="8" className="stroke-accent" fill="none" strokeWidth="0.8" />
      </g>
      <path
        className="pop stroke-accent"
        style={cssVars({ "--delay": "1.3s" })}
        d="M142 110 Q178 120 192 152"
        fill="none"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
    </svg>
  );
}

export function PairScene() {
  return (
    <Scene id="pair" index={3} label="Pair" title="Match the bottle to the plate." side="left" art={<PairArt />}>
      <p className="text-ink-muted mb-6">
        Tell us what's for dinner and we'll find wines whose sweetness, acidity, tannin, and body suit it.
      </p>
      <ul className="flex flex-wrap gap-2 mb-6">
        {SAMPLE_FOODS.map((key, i) => (
          <li
            key={key}
            className="pop rounded-full border border-surface-border px-3 py-1 text-sm text-ink"
            style={cssVars({ "--delay": `${1.1 + i * 0.15}s` })}
          >
            {FOOD_PAIRINGS[key].label}
          </li>
        ))}
      </ul>
      <SceneCta to="/pair">Pair With Food</SceneCta>
    </Scene>
  );
}
```

- [ ] **Step 5: Write CompareScene**

`frontend/src/components/home/scenes/CompareScene.tsx`:

```tsx
import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const RADAR_CENTER = { x: 120, y: 190 };
const RADAR_RADIUS = 24;
const OUTLINE = [1, 1, 1, 1, 1];
const SHAPE_A = [0.8, 0.5, 0.6, 0.3, 0.7];
const SHAPE_B = [0.4, 0.8, 0.5, 0.6, 0.4];

function pentagonPoints(values: readonly number[]): string {
  return values
    .map((value, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
      const x = RADAR_CENTER.x + Math.cos(angle) * RADAR_RADIUS * value;
      const y = RADAR_CENTER.y + Math.sin(angle) * RADAR_RADIUS * value;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function CompareArt() {
  return (
    <svg viewBox="0 0 240 220" className="w-full max-w-sm mx-auto" focusable="false">
      <g transform="translate(20 0) scale(0.8)">
        <g className="slide" style={cssVars({ "--from-x": "50px", "--delay": "0.5s" })}>
          <Glass wine="red" level="high" />
        </g>
      </g>
      <g transform="translate(92 0) scale(0.8)">
        <g className="slide" style={cssVars({ "--from-x": "-50px", "--delay": "0.5s" })}>
          <Glass wine="white" level="mid" />
        </g>
      </g>
      <polygon
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.9s" })}
        points={pentagonPoints(OUTLINE)}
        fill="none"
        strokeWidth="0.8"
      />
      <polygon className="radar-a fill-wine-red" style={cssVars({ "--delay": "1.4s" })} points={pentagonPoints(SHAPE_A)} fillOpacity="0.55" />
      <polygon className="radar-b fill-wine-white" style={cssVars({ "--delay": "1.4s" })} points={pentagonPoints(SHAPE_B)} fillOpacity="0.55" />
    </svg>
  );
}

export function CompareScene() {
  return (
    <Scene id="compare" index={4} label="Compare" title="Taste two wines side by side." side="right" art={<CompareArt />}>
      <p className="text-ink-muted mb-6">
        Put up to four wines next to each other — price, region, grapes, and a taste radar that shows where they
        differ.
      </p>
      <SceneCta to="/compare">Compare Wines</SceneCta>
    </Scene>
  );
}
```

- [ ] **Step 6: Write LearnScene**

`frontend/src/components/home/scenes/LearnScene.tsx`:

```tsx
import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const VINE_ROWS = [150, 170, 190];
const REGIONS: ReadonlyArray<readonly [name: string, x: number, y: number]> = [
  ["Bordeaux", 165, 55],
  ["Napa", 200, 45],
  ["Barossa", 190, 85],
];

function LearnArt() {
  return (
    <svg viewBox="0 0 260 220" className="w-full max-w-md mx-auto" focusable="false">
      <g className="fade-out" style={cssVars({ "--delay": "0.6s" })}>
        <Glass wine="rose" level="low" />
      </g>
      {VINE_ROWS.map((y, i) => (
        <path
          key={y}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.8 + i * 0.2}s` })}
          d={`M20 ${y} q15 -14 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0`}
          fill="none"
          strokeWidth="1"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "1.2s" })}
        d="M150 30 q20 -10 40 0 q25 5 30 25 q5 25 -15 40 q-20 12 -45 5 q-25 -8 -25 -35 q0 -25 15 -35 z"
        fill="none"
        strokeWidth="0.9"
      />
      {REGIONS.map(([name, x, y], i) => (
        <g key={name} className="pop" style={cssVars({ "--delay": `${1.8 + i * 0.15}s` })}>
          <circle cx={x} cy={y} r="2.5" className="fill-wine-rose" />
          <text x={x + 5} y={y + 3} fontSize="8" className="fill-ink-muted">
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function LearnScene() {
  return (
    <Scene id="learn" index={5} label="Learn" title="Learn what's in your glass." side="left" art={<LearnArt />}>
      <p className="text-ink-muted mb-6">
        Grapes, regions, and the words behind the wine — the Learn guide is being poured now.
      </p>
      <SceneCta to="/learn">Start Learning</SceneCta>
    </Scene>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/components/home/scenes`
Expected: PASS (FeatureScenes and ExploreScene).

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc -b`
Expected: no errors.

```bash
git add src/components/home/scenes
git commit -m "feat: add Discover, Pair, Compare, and Learn home scenes"
```

---

### Task 8: Finale and HomePage composition

**Files:**
- Create: `frontend/src/components/home/Finale.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`
- Test: `frontend/src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `HeroPour` (Task 5); `ExploreScene` (Task 6); `DiscoverScene`, `PairScene`, `CompareScene`, `LearnScene` (Task 7).
- Produces: `Finale()` — `<section id="all-features" tabIndex={-1} aria-labelledby="finale-title">`; `HomePage()`.

- [ ] **Step 1: Write the failing test**

`frontend/src/pages/HomePage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";
import * as api from "../services/api";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
  vi.stubGlobal("innerWidth", 1440);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((media: string) => ({
      matches: media === "(prefers-reduced-motion: reduce)",
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe("HomePage (reduced motion)", () => {
  it("renders the hero headline, five scenes, and the finale in order", async () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Find a wine you'll actually enjoy." })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Wander the whole cellar.",
      "Find your wine profile.",
      "Match the bottle to the plate.",
      "Taste two wines side by side.",
      "Learn what's in your glass.",
      "Your next favorite bottle is a few clicks away.",
    ]);
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });

  it("links every CTA to its destination", async () => {
    renderHome();
    const exploreCtas = screen.getAllByRole("link", { name: "Explore Wines" });
    expect(exploreCtas).toHaveLength(2);
    exploreCtas.forEach((link) => expect(link).toHaveAttribute("href", "/explore"));
    expect(screen.getByRole("link", { name: "Find Your Profile" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "Pair With Food" })).toHaveAttribute("href", "/pair");
    expect(screen.getByRole("link", { name: "Compare Wines" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: "Start Learning" })).toHaveAttribute("href", "/learn");
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });

  it("renders the finale as the skip-link target with all five destinations", async () => {
    renderHome();
    const finale = screen.getByRole("region", { name: "Your next favorite bottle is a few clicks away." });
    expect(finale).toHaveAttribute("id", "all-features");
    expect(finale).toHaveAttribute("tabindex", "-1");
    for (const [name, href] of [
      [/^Explore/, "/explore"],
      [/^Discover/, "/discover"],
      [/^Pair/, "/pair"],
      [/^Compare/, "/compare"],
      [/^Learn/, "/learn"],
    ] as const) {
      const link = Array.from(finale.querySelectorAll("a")).find((a) => name.test(a.textContent ?? ""));
      expect(link).toHaveAttribute("href", href);
    }
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });

  it("shows the poster instead of a canvas", async () => {
    const { container } = renderHome();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('img[src="/hero/desktop/poster.webp"]')).not.toBeNull();
    await screen.findByText("Hundreds of wines by type, country, grape and price.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/HomePage.test.tsx`
Expected: FAIL — old `HomePage` has no scenes/finale.

- [ ] **Step 3: Write Finale**

`frontend/src/components/home/Finale.tsx`:

```tsx
import { Link } from "react-router-dom";

const DESTINATIONS = [
  { to: "/explore", title: "Explore", blurb: "Browse the full catalog" },
  { to: "/discover", title: "Discover", blurb: "Find your wine profile" },
  { to: "/pair", title: "Pair", blurb: "Match wine to food" },
  { to: "/compare", title: "Compare", blurb: "Wines side by side" },
  { to: "/learn", title: "Learn", blurb: "Grapes, regions, terms" },
];

export function Finale() {
  return (
    <section
      id="all-features"
      tabIndex={-1}
      aria-labelledby="finale-title"
      className="py-24 md:min-h-screen flex flex-col justify-center text-center focus:outline-none"
    >
      <h2 id="finale-title" className="font-serif text-3xl md:text-4xl text-ink mb-10">
        Your next favorite bottle is a few clicks away.
      </h2>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-5 text-left">
        {DESTINATIONS.map((destination) => (
          <li key={destination.to}>
            <Link
              to={destination.to}
              className="block h-full rounded border border-surface-border p-4 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="block font-serif text-lg text-ink mb-1">{destination.title}</span>
              <span className="block text-sm text-ink-muted">{destination.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Replace HomePage**

Replace `frontend/src/pages/HomePage.tsx` with:

```tsx
import { HeroPour } from "../components/home/HeroPour";
import { Finale } from "../components/home/Finale";
import { ExploreScene } from "../components/home/scenes/ExploreScene";
import { DiscoverScene } from "../components/home/scenes/DiscoverScene";
import { PairScene } from "../components/home/scenes/PairScene";
import { CompareScene } from "../components/home/scenes/CompareScene";
import { LearnScene } from "../components/home/scenes/LearnScene";

export function HomePage() {
  return (
    <>
      <HeroPour />
      <div className="max-w-6xl mx-auto px-4">
        <ExploreScene />
        <DiscoverScene />
        <PairScene />
        <CompareScene />
        <LearnScene />
        <Finale />
      </div>
    </>
  );
}
```

- [ ] **Step 5: Run the page and app tests**

Run: `npx vitest run src/pages/HomePage.test.tsx src/App.test.tsx`
Expected: PASS. (`App.test.tsx`'s "nav links" test still passes: finale link names are "Explore Browse the full catalog" etc., not exactly "Explore".)

- [ ] **Step 6: Run the full suite and type-check**

Run: `npx vitest run && npx tsc -b`
Expected: all tests PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/home/Finale.tsx src/pages/HomePage.tsx src/pages/HomePage.test.tsx
git commit -m "feat: compose scroll-driven home page with finale grid"
```

---

### Task 9: Build budget and visual verification

**Files:**
- Possibly modify (tuning only): `frontend/src/components/home/**/*.tsx`, `frontend/src/components/home/home.css`

**Interfaces:**
- Consumes: the finished page.
- Produces: verified build + screenshots; any art-position/timing tweaks committed.

- [ ] **Step 1: Check the production build and chunk budget**

Run: `npx vite build`
Expected: build succeeds; `dist/assets/index-*.js` gzip ≤ 86.9 kB (baseline 71.88 + 15). `CompareRadarChart-*.js` remains a separate chunk. Record both numbers.

- [ ] **Step 2: Launch the app**

Start the backend and frontend the way this project runs them (see `README.md`; frontend is `npm run dev` in `frontend/`). Use the `run` skill if available.

- [ ] **Step 3: Capture screenshots**

For each theme (`dark-burgundy`, `cream-terracotta`, `charcoal-gold` — switch with the header's theme select) at widths 1440 and 375, capture:
- hero at scroll progress ≈ 0, 0.5, 1 (scroll to 0, 0.75, and 1.5 viewport heights)
- each of the five scenes after it has animated in
- the finale

Then enable reduced motion (browser devtools → Rendering → emulate `prefers-reduced-motion: reduce`) and capture the hero and one scene at 1440.

- [ ] **Step 4: Check against the spec and tune**

Verify and fix any of these (tuning SVG `translate`/`scale` values, `--delay`s, or copy spacing only):
- Hero text is readable over the frames in all themes; the stream never shows a bottle lip; the cellar fade reaches the page surface without a visible seam.
- On 375px the glass sits below the headline and is not cropped at the sides.
- The overlay header is readable on the hero in all themes.
- Explore bottles don't obscure the glass outline; Compare glasses don't overlap the radar; Learn labels don't collide with the map outline.
- No horizontal scrollbar at 375px.
- Tab order: skip link → header → hero CTA → scene CTAs → finale; activating the skip link focuses the finale.

- [ ] **Step 5: Re-run tests and commit tuning**

Run: `npx vitest run && npx tsc -b`
Expected: PASS.

```bash
git add src/components/home
git commit -m "fix: tune home scene art positions after visual review"
```

(Skip the commit if no tuning was needed.)

- [ ] **Step 6: Final whole-branch review**

Per project cadence: dispatch one final whole-branch review on a strong model covering commits since `ded68ed`, then address findings in a single fix wave.
