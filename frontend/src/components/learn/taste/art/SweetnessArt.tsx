import { Glass } from "../../../home/art/Glass";
import { cssVars } from "../../../home/art/cssVars";

const GRAPES: ReadonlyArray<readonly [x: number, y: number]> = [
  [84, 22],
  [100, 22],
  [116, 22],
  [92, 36],
  [108, 36],
  [100, 50],
];

export function SweetnessArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M100 14 V4 q8 -6 16 -2" fill="none" strokeWidth="1.4" />
      {GRAPES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.1 + i * 0.08}s` })}
          cx={x}
          cy={y}
          r="8"
          fill="none"
          strokeWidth="1.2"
        />
      ))}
      <path
        className="drip fill-wine-white"
        style={cssVars({ "--delay": "1.2s", "--drip-y": "54px" })}
        d="M100 62 q-5 8 0 12 q5 -4 0 -12 z"
      />
      <g transform="translate(30 70) scale(0.7)">
        <Glass wine="white" level="mid" />
      </g>
    </svg>
  );
}
