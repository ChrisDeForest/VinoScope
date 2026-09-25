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
