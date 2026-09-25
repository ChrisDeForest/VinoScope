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
