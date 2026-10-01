import { useEffect, useState } from "react";

// A chapter counts as "current" while it crosses a band just below the sticky nav.
const ACTIVE_BAND = "-20% 0px -70% 0px";
// The band's top edge, as a fraction of the viewport (matches the -20% top margin above).
const BAND_TOP = 0.2;

export function useActiveChapter(ids: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  // Joined so a new array with the same ids doesn't re-subscribe every render.
  const key = ids.join("|");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Fast scrolls and anchor jumps can deliver several entering chapters at once; take the one nearest the band.
        const bandTop = window.innerHeight * BAND_TOP;
        let nearest: IntersectionObserverEntry | undefined;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const distance = Math.abs(entry.boundingClientRect.top - bandTop);
          if (!nearest || distance < Math.abs(nearest.boundingClientRect.top - bandTop)) nearest = entry;
        }
        if (nearest) setActive(nearest.target.id);
      },
      { rootMargin: ACTIVE_BAND }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [key]);

  return active;
}
