import { cssVars } from "../../../home/art/cssVars";

const BUBBLES: ReadonlyArray<readonly [x: number, y: number]> = [
  [88, 180],
  [102, 170],
  [114, 184],
  [94, 150],
  [108, 140],
];

export function BottleArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-[12rem] mx-auto" focusable="false">
      <rect
        className="fill-up fill-wine-white"
        style={cssVars({ "--delay": "0.7s" })}
        x="72"
        y="110"
        width="56"
        height="88"
        fillOpacity="0.85"
      />
      {BUBBLES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="rise stroke-accent"
          style={cssVars({ "--delay": `${1.3 + i * 0.18}s`, "--rise-y": "-28px" })}
          cx={x}
          cy={y}
          r="2.5"
          fill="none"
          strokeWidth="0.9"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        d="M90 22 H110 V60 Q130 72 130 95 V200 H70 V95 Q70 72 90 60 Z"
        fill="none"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.3s" })} d="M92 12 H108 V22 H92 Z" fill="none" strokeWidth="1.2" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.5s" })} d="M76 128 H124 V164 H76 Z" fill="none" strokeWidth="1" />
    </svg>
  );
}
