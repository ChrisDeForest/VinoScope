import { useEffect, useState } from "react";

// A chapter counts as "current" while it crosses a band just below the sticky nav.
const ACTIVE_BAND = "-20% 0px -70% 0px";

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
        const entering = entries.find((entry) => entry.isIntersecting);
        if (entering) setActive(entering.target.id);
      },
      { rootMargin: ACTIVE_BAND }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [key]);

  return active;
}
