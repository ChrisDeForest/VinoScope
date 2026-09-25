import { useEffect, useState } from "react";

// True once the element with the given id has scrolled past the top of the
// viewport (its top edge is above 0 and it is no longer intersecting), false
// otherwise — including while it hasn't been observed yet, or when the
// element or IntersectionObserver itself is unavailable.
export function useScrolledPast(elementId: string): boolean {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const element = document.getElementById(elementId);
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setScrolledPast(entry.boundingClientRect.top < 0 && !entry.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementId]);

  return scrolledPast;
}
