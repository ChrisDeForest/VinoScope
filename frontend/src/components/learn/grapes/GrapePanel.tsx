import { useRef } from "react";
import type { GrapeContent } from "../../../content/learn/grapes";
import { useReveal } from "../../../hooks/useReveal";
import { GrapeArt } from "./GrapeArt";
import { GrapeExploreLink } from "./GrapeExploreLink";
import { GRAPE_PANEL_ID, grapeTabId } from "./GrapePicker";
import { ProfileBars } from "./ProfileBars";
import "../../home/home.css";
import "../learn.css";

const COLOR_LABEL = { red: "Red grape", white: "White grape" } as const;

export function GrapePanel({ grape }: { grape: GrapeContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useReveal(ref);
  const classes = ["scene grid gap-8 rounded border border-surface-border p-6 mt-4 md:grid-cols-3 md:items-start", ...reveal];

  return (
    <div ref={ref} role="tabpanel" id={GRAPE_PANEL_ID} aria-labelledby={grapeTabId(grape.id)} className={classes.join(" ")}>
      <div data-testid="grape-art" aria-hidden="true">
        <GrapeArt color={grape.color} />
      </div>
      <div className="md:col-span-2 grid gap-4">
        <div>
          <h3 className="font-serif text-2xl text-ink">{grape.name}</h3>
          <p className="text-xs uppercase tracking-wide text-accent mt-1">{COLOR_LABEL[grape.color]}</p>
          <p className="text-ink-muted mt-2">{grape.tagline}</p>
        </div>
        <dl className="grid gap-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">What it's like</dt>
            <dd className="text-ink">{grape.about}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Tastes like</dt>
            <dd>
              <ul className="mt-1 flex flex-wrap gap-2">
                {grape.notes.map((note) => (
                  <li key={note} className="rounded-full border border-surface-border px-3 py-1 text-sm text-ink">
                    {note}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent mb-2">Typical profile</dt>
            <dd>
              <ProfileBars profile={grape.profile} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-accent">Where it shines</dt>
            <dd className="text-ink">{grape.regions.join(", ")}</dd>
          </div>
        </dl>
        <div>
          <GrapeExploreLink name={grape.name} exploreGrape={grape.exploreGrape} />
        </div>
      </div>
    </div>
  );
}
