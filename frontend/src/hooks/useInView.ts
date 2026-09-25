import { useEffect, useState, type RefObject } from "react";

interface UseInViewOptions {
  threshold?: number;
  /** Wait this long after the element enters view; leaving view before then cancels the reveal. */
  delayMs?: number;
}

export function useInView(ref: RefObject<Element>, { threshold = 0.25, delayMs = 0 }: UseInViewOptions = {}): boolean {
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
        if (entries.some((entry) => entry.isIntersecting)) {
          if (delayMs <= 0) reveal();
          else if (timer === undefined) timer = setTimeout(reveal, delayMs);
        } else if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold }
    );
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref, inView, threshold, delayMs]);

  return inView;
}
