import type { GrapeColor } from "../../../content/learn/grapes";
import { cssVars } from "../../home/art/cssVars";

const BERRIES: ReadonlyArray<readonly [x: number, y: number]> = [
  [68, 64],
  [86, 60],
  [104, 60],
  [122, 60],
  [140, 64],
  [78, 80],
  [96, 78],
  [114, 78],
  [132, 80],
  [88, 96],
  [106, 96],
  [124, 96],
  [98, 112],
  [116, 112],
  [107, 128],
];

const BERRY_FILL: Record<GrapeColor, string> = { red: "fill-wine-red", white: "fill-wine-white" };

export function GrapeArt({ color }: { color: GrapeColor }) {
  return (
    <svg viewBox="0 0 210 160" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M104 50 V30 q10 -12 26 -10" fill="none" strokeWidth="1.6" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.25s" })}
        d="M130 20 q24 -20 50 -4 q-6 26 -34 24 q-14 -6 -16 -20 z"
        fill="none"
        strokeWidth="1.3"
      />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.45s" })}
        d="M132 20 q20 2 40 -2"
        fill="none"
        strokeWidth="0.8"
      />
      {BERRIES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className={`pop ${BERRY_FILL[color]} stroke-accent`}
          style={cssVars({ "--delay": `${0.6 + i * 0.05}s` })}
          cx={x}
          cy={y}
          r="9"
          fillOpacity="0.85"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}
