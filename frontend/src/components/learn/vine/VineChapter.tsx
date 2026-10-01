import { useRef } from "react";
import { VINE_STAGES } from "../../../content/learn/vine";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { throughProgress, useScrollProgress } from "../../../hooks/useScrollProgress";
import { VineStage } from "./VineStage";

export function VineChapter() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Written straight to the element so scrolling never re-renders the chapter.
  useScrollProgress(
    timelineRef,
    (progress) => {
      if (spineRef.current) spineRef.current.style.transform = `scaleY(${progress})`;
    },
    !reducedMotion,
    throughProgress
  );

  return (
    <div ref={timelineRef} data-testid="vine-timeline" className="relative mt-8">
      <div aria-hidden="true" className="absolute inset-y-0 left-6 w-0.5 -translate-x-1/2 md:left-1/2">
        <div className="absolute inset-0 bg-surface-border" />
        {/* Starts undrawn (no flash of a full vine) unless motion is reduced; React leaves the
            transform alone afterwards because this prop only changes with the motion preference. */}
        <div
          ref={spineRef}
          data-testid="vine-spine"
          className="absolute inset-0 origin-top bg-accent"
          style={{ transform: `scaleY(${reducedMotion ? 1 : 0})` }}
        />
      </div>
      <ol className="relative">
        {VINE_STAGES.map((stage, index) => (
          <VineStage key={stage.id} stage={stage} index={index} />
        ))}
      </ol>
    </div>
  );
}
