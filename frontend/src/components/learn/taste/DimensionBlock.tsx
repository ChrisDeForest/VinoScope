import { useRef } from "react";
import { useReveal } from "../../../hooks/useReveal";
import type { TasteDimensionContent } from "../../../content/learn/taste";
import { DIMENSION_TITLES } from "../../../utils/dimensionLabels";
import { DIMENSION_ART } from "./art";
import { DimensionScale, type ScaleMarker } from "./DimensionScale";
import { ExampleWineCard, ExampleWineCardSkeleton } from "./ExampleWineCard";
import type { PairState } from "./pairs";
import "../../home/home.css";
import "../learn.css";

interface DimensionBlockProps {
  content: TasteDimensionContent;
  pair: PairState;
  side: "left" | "right";
}

function markersFor(content: TasteDimensionContent, pair: PairState): ScaleMarker[] {
  if (pair.status !== "ready") return [];
  const { dimension } = content;
  return [
    { score: pair.low[dimension] ?? 0, name: pair.low.name, tone: "low" },
    { score: pair.high[dimension] ?? 0, name: pair.high.name, tone: "high" },
  ];
}

function Pair({ content, pair }: { content: TasteDimensionContent; pair: PairState }) {
  if (pair.status === "hidden") return null;
  if (pair.status === "loading") {
    return (
      <>
        <p role="status" className="sr-only">
          Loading example wines…
        </p>
        <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
          <ExampleWineCardSkeleton />
          <ExampleWineCardSkeleton />
        </div>
      </>
    );
  }
  return (
    <ul aria-label="Example wines" className="grid gap-3 sm:grid-cols-2">
      <li>
        <ExampleWineCard wine={pair.low} dimension={content.dimension} tone="low" reason={content.low.reason} />
      </li>
      <li>
        <ExampleWineCard wine={pair.high} dimension={content.dimension} tone="high" reason={content.high.reason} />
      </li>
    </ul>
  );
}

export function DimensionBlock({ content, pair, side }: DimensionBlockProps) {
  const ref = useRef<HTMLElement>(null);
  const reveal = useReveal(ref);
  const titleId = `taste-${content.dimension}-title`;
  const Art = DIMENSION_ART[content.dimension];
  const classes = ["scene grid items-center gap-10 py-12 md:grid-cols-2", ...reveal];

  return (
    <article ref={ref} aria-labelledby={titleId} className={classes.join(" ")}>
      <div data-testid="dimension-art" aria-hidden="true" className={side === "right" ? "md:order-last" : undefined}>
        <Art />
      </div>
      <div>
        <h3 id={titleId} className="font-serif text-2xl text-ink mb-4">
          {DIMENSION_TITLES[content.dimension]}
        </h3>
        <dl className="grid gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">What it is</dt>
            <dd className="text-ink">{content.what}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">How it feels</dt>
            <dd className="text-ink">{content.feel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Try this</dt>
            <dd className="text-ink-muted">{content.tip}</dd>
          </div>
        </dl>
        <DimensionScale dimension={content.dimension} markers={markersFor(content, pair)} />
        <Pair content={content} pair={pair} />
      </div>
    </article>
  );
}
