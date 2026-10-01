import { useEffect, useRef, type RefObject } from "react";

export interface ProgressInput {
  top: number;
  height: number;
  viewportHeight: number;
}

// Progress of an element through the part of its height that extends past the
// viewport — i.e. how far a sticky child pinned inside it has been scrubbed.
export function scrollProgress({ top, height, viewportHeight }: ProgressInput): number {
  const range = height - viewportHeight;
  if (range <= 0) return top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / range));
}

// How far a reading line `anchor` of the way down the viewport has travelled
// through an element — for things that grow alongside the reader, not pinned ones.
export function throughProgress({ top, height, viewportHeight, anchor = 0.6 }: ProgressInput & { anchor?: number }): number {
  const line = anchor * viewportHeight;
  if (height <= 0) return top <= line ? 1 : 0;
  return Math.min(1, Math.max(0, (line - top) / height));
}

export function useScrollProgress(
  ref: RefObject<HTMLElement>,
  onProgress: (progress: number) => void,
  enabled = true,
  progressFn: (input: ProgressInput) => number = scrollProgress
): void {
  const callbackRef = useRef(onProgress);
  const progressFnRef = useRef(progressFn);

  useEffect(() => {
    callbackRef.current = onProgress;
    progressFnRef.current = progressFn;
  });

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      callbackRef.current(progressFnRef.current({ top: rect.top, height: rect.height, viewportHeight: window.innerHeight }));
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
