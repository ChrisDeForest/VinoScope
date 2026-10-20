import { useEffect, useState, type RefObject } from "react";

interface UseInViewOptions {
  /**
   * Share of the element that must be on screen. An element taller than the viewport counts once
   * it fills this share of the viewport instead, since it can never be that much visible.
   */
  threshold?: number;
  /** Wait this long after the element enters view; leaving view before then cancels the reveal. */
  delayMs?: number;
}

// Report every 5% of change so both rules below are re-checked as the element scrolls in.
const OBSERVER_STEPS = Array.from({ length: 21 }, (_, step) => step / 20);

function mostlyVisible(entry: IntersectionObserverEntry, threshold: number): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= threshold) return true;
  const viewport = entry.rootBounds?.height;
  return viewport !== undefined && viewport > 0 && entry.intersectionRect.height >= viewport * threshold;
}

export function useInView(ref: RefObject<Element>, { threshold = 0.5, delayMs = 0 }: UseInViewOptions = {}): boolean {
  // Without IntersectionObserver there is nothing to wait for, so content shows immediately.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (inView || !element || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      setInView(true);
      observer.disconnect();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => mostlyVisible(entry, threshold))) {
          if (delayMs <= 0) reveal();
          else if (timer === undefined) timer = setTimeout(reveal, delayMs);
        } else if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: OBSERVER_STEPS }
    );
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref, inView, threshold, delayMs]);

  return inView;
}
