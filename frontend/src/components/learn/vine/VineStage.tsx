import { useRef } from "react";
import { useReveal } from "../../../hooks/useReveal";
import type { VineStageContent } from "../../../content/learn/vine";
import { STAGE_ART } from "./art";
import { StyleCallout } from "./StyleCallout";
import "../../home/home.css";
import "../learn.css";

export function VineStage({ stage, index }: { stage: VineStageContent; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const reveal = useReveal(ref);
  const titleId = `vine-${stage.id}-title`;
  const Art = STAGE_ART[stage.id];
  const textFirst = index % 2 === 0;
  const classes = ["scene relative grid items-center gap-6 py-10 pl-12 md:pl-0 md:grid-cols-2 md:gap-20", ...reveal];

  return (
    <li ref={ref} aria-labelledby={titleId} className={classes.join(" ")}>
      <span
        data-testid="stage-node"
        aria-hidden="true"
        className="absolute left-6 top-12 -translate-x-1/2 rotate-45 md:left-1/2 md:top-1/2 md:-translate-y-1/2"
      >
        <span className="pop block h-4 w-4 rounded-tl-full rounded-br-full border border-accent bg-surface" />
      </span>
      <div data-testid="stage-art" aria-hidden="true" className={textFirst ? "md:order-last" : undefined}>
        <Art />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent mb-2">Step {index + 1}</p>
        <h3 id={titleId} className="font-serif text-2xl text-ink mb-4">
          {stage.title}
        </h3>
        <dl className="grid gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">What happens</dt>
            <dd className="text-ink">{stage.what}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Why it matters</dt>
            <dd className="text-ink-muted">{stage.why}</dd>
          </div>
        </dl>
        {stage.callouts && stage.callouts.length > 0 ? (
          <ul className="mt-4 grid gap-2">
            {stage.callouts.map((callout) => (
              <li key={callout.style}>
                <StyleCallout style={callout.style} text={callout.text} />
              </li>
            ))}
          </ul>
        ) : null}
        {stage.link ? (
          <a
            href={stage.link.href}
            className="mt-4 inline-block text-accent font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {stage.link.label} <span aria-hidden="true">↑</span>
          </a>
        ) : null}
      </div>
    </li>
  );
}
