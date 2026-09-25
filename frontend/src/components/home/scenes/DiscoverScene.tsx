import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const SAMPLE_PROFILE: ReadonlyArray<readonly [label: string, value: number]> = [
  ["Body", 0.7],
  ["Tannin", 0.55],
  ["Acidity", 0.6],
  ["Sweetness", 0.2],
  ["Fruitiness", 0.65],
];

function DiscoverArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-sm mx-auto" focusable="false">
      <Glass wine="red" level="mid" surfaceClassName="swirl" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "1.2s" })}
        d="M30 60 q6 -8 12 0 M158 110 q6 -8 12 0"
        fill="none"
        strokeWidth="0.8"
      />
    </svg>
  );
}

export function DiscoverScene() {
  return (
    <Scene id="discover" index={2} label="Discover" title="Find your wine profile." side="right" art={<DiscoverArt />}>
      <p className="text-ink-muted mb-6">
        Answer a few questions about what you like and we map your taste — then match it against every wine in
        the catalog.
      </p>
      <dl className="grid gap-2 mb-6 max-w-xs">
        {SAMPLE_PROFILE.map(([label, value], i) => (
          <div key={label} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="h-1.5 rounded bg-surface-border overflow-hidden">
              <span
                className="meter-fill block h-full bg-accent"
                style={cssVars({ "--value": String(value), "--delay": `${0.4 + i * 0.12}s` })}
              />
            </dd>
            <dd className="text-ink-muted text-right">{Math.round(value * 100)}%</dd>
          </div>
        ))}
      </dl>
      <SceneCta to="/discover">Find Your Profile</SceneCta>
    </Scene>
  );
}
