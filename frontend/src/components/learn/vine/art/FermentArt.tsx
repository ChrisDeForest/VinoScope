import { cssVars } from "../../../home/art/cssVars";

const BUBBLES: ReadonlyArray<readonly [x: number, y: number, r: number]> = [
  [80, 160, 3],
  [100, 150, 4],
  [120, 165, 3],
  [90, 125, 2.5],
  [112, 118, 3.5],
  [128, 135, 2.5],
];

export function FermentArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-xs mx-auto" focusable="false">
      <rect
        className="fill-up fill-wine-red"
        style={cssVars({ "--delay": "0.6s" })}
        x="62"
        y="80"
        width="76"
        height="108"
        fillOpacity="0.7"
      />
      {BUBBLES.map(([x, y, r], i) => (
        <circle
          key={`${x}-${y}`}
          className="rise stroke-accent"
          style={cssVars({ "--delay": `${1.2 + i * 0.2}s`, "--rise-y": "-36px" })}
          cx={x}
          cy={y}
          r={r}
          fill="none"
          strokeWidth="1"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        d="M60 40 H140 V180 Q140 190 130 190 H70 Q60 190 60 180 Z"
        fill="none"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.3s" })} d="M100 40 V24 q10 0 10 -8" fill="none" strokeWidth="1.2" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M72 190 V206 M128 190 V206" fill="none" strokeWidth="1.4" />
    </svg>
  );
}
