import { useEffect, useState } from "react";

// True once the element with the given id has scrolled past the top of the
// viewport (its top edge is above 0 and it is no longer intersecting), false
// otherwise — including while it hasn't been observed yet, or when the
// element or IntersectionObserver itself is unavailable.
//
// `enabled` lets a caller that mounts once for the whole app (e.g. a layout
// shell wrapping client-side routing) re-subscribe whenever the thing that
// controls whether the sentinel is relevant changes — typically the route.
// Toggling it off resets the state to false and tears down the observer, so
// stale state from a previous subscription never leaks into the next one.
export function useScrolledPast(elementId: string, enabled = true): boolean {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const element = document.getElementById(elementId);
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setScrolledPast(entry.boundingClientRect.top < 0 && !entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      setScrolledPast(false);
    };
  }, [elementId, enabled]);

  return scrolledPast;
}
