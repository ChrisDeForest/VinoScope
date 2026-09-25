import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const VINE_ROWS = [150, 170, 190];
const REGIONS: ReadonlyArray<readonly [name: string, x: number, y: number]> = [
  ["Bordeaux", 165, 55],
  ["Napa", 200, 45],
  ["Barossa", 190, 85],
];

function LearnArt() {
  return (
    <svg viewBox="0 0 260 220" className="w-full max-w-md mx-auto" focusable="false">
      <g className="fade-out" style={cssVars({ "--delay": "0.6s" })}>
        <Glass wine="rose" level="low" />
      </g>
      {VINE_ROWS.map((y, i) => (
        <path
          key={y}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.8 + i * 0.2}s` })}
          d={`M20 ${y} q15 -14 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0`}
          fill="none"
          strokeWidth="1"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "1.2s" })}
        d="M150 30 q20 -10 40 0 q25 5 30 25 q5 25 -15 40 q-20 12 -45 5 q-25 -8 -25 -35 q0 -25 15 -35 z"
        fill="none"
        strokeWidth="0.9"
      />
      {REGIONS.map(([name, x, y], i) => (
        <g key={name} className="pop" style={cssVars({ "--delay": `${1.8 + i * 0.15}s` })}>
          <circle cx={x} cy={y} r="2.5" className="fill-wine-rose" />
          <text x={x + 5} y={y + 3} fontSize="8" className="fill-ink-muted">
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function LearnScene() {
  return (
    <Scene id="learn" index={5} label="Learn" title="Learn what's in your glass." side="left" art={<LearnArt />}>
      <p className="text-ink-muted mb-6">
        Grapes, regions, and the words behind the wine — the Learn guide is being poured now.
      </p>
      <SceneCta to="/learn">Start Learning</SceneCta>
    </Scene>
  );
}
