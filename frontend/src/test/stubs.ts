import { vi } from "vitest";
import { act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// matchMedia
// ---------------------------------------------------------------------------

interface StubMatchMediaOptions {
  /**
   * Every query resolves to this value. Use for components/hooks that only
   * ever query `(prefers-reduced-motion: reduce)`, where "matches" and
   * "reduced motion is on" are effectively the same thing.
   */
  reducedMotion?: boolean;
  /**
   * Query-aware fake: resolves each query through this predicate. Use when a
   * test wants to assert behavior for one specific media query while every
   * other query resolves false (e.g. exercising real component code that
   * queries `matchMedia` for more than one thing).
   */
  matches?: (query: string) => boolean;
}

/**
 * Stubs `window.matchMedia`. Returns `emit(matches)`, which fires a "change"
 * event on the most recently created `MediaQueryList` the way a real
 * `matchMedia` result would — callers that never toggle the preference can
 * just ignore the return value.
 */
export function stubMatchMedia(options: StubMatchMediaOptions = {}): (matches: boolean) => void {
  const { reducedMotion = false, matches } = options;
  const matchFn = matches ?? (() => reducedMotion);
  let listener: ((event: { matches: boolean }) => void) | null = null;
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((media: string) => ({
      matches: matchFn(media),
      media,
      addEventListener: (_type: string, handler: (event: { matches: boolean }) => void) => {
        listener = handler;
      },
      removeEventListener: vi.fn(),
    }))
  );
  return (next: boolean) => listener?.({ matches: next });
}

// ---------------------------------------------------------------------------
// IntersectionObserver
// ---------------------------------------------------------------------------

export interface FakeIntersectionObserverInstance {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
}

export interface StubIntersectionObserverResult {
  /** One entry per `new IntersectionObserver(...)` call, in construction order. */
  instances: FakeIntersectionObserverInstance[];
  /**
   * Invokes the callback of `instances[index]` with a single entry, wrapped
   * in `act()`. `top` defaults to 0 for tests that only care about
   * `isIntersecting`.
   */
  fire: (index: number, isIntersecting: boolean, top?: number) => void;
}

/** Stubs the global `IntersectionObserver` with a fake that records instances. */
export function stubIntersectionObserver(): StubIntersectionObserverResult {
  const instances: FakeIntersectionObserverInstance[] = [];

  class FakeIntersectionObserver implements FakeIntersectionObserverInstance {
    callback: IntersectionObserverCallback;
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }
  }

  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

  function fire(index: number, isIntersecting: boolean, top = 0): void {
    act(() => {
      instances[index].callback(
        [{ isIntersecting, boundingClientRect: { top } as DOMRect } as IntersectionObserverEntry],
        instances[index] as unknown as IntersectionObserver
      );
    });
  }

  return { instances, fire };
}

// ---------------------------------------------------------------------------
// navigator.connection
// ---------------------------------------------------------------------------

/** Stubs the non-standard `navigator.connection`. Pair with `restoreConnection()` in `afterEach`. */
export function stubConnection(value: unknown): void {
  Object.defineProperty(navigator, "connection", { value, configurable: true });
}

/** Undoes `stubConnection`. Safe to call even if `stubConnection` was never invoked in a given test. */
export function restoreConnection(): void {
  // @ts-expect-error -- test-only cleanup of a non-standard navigator property
  delete navigator.connection;
}
