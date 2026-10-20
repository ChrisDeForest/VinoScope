import type { RefObject } from "react";
import { useInView } from "./useInView";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Let an element settle on screen before it animates, so the motion isn't over before the eye arrives.
export const REVEAL_DELAY_MS = 200;

/**
 * Classes for the shared reveal contract in `components/home/home.css`:
 * `scene-animate` opts into the initial (hidden) state only when motion is
 * allowed, and `is-visible` switches to the finished state once in view.
 */
export function useReveal(ref: RefObject<Element>, { delayMs = REVEAL_DELAY_MS }: { delayMs?: number } = {}): string[] {
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(ref, { delayMs });
  const classes: string[] = [];
  if (!reducedMotion) classes.push("scene-animate");
  if (inView) classes.push("is-visible");
  return classes;
}
