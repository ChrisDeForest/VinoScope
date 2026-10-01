import { cssVars } from "../../../home/art/cssVars";

const GRAPES: ReadonlyArray<readonly [x: number, y: number]> = [
  [90, 112],
  [104, 108],
  [118, 112],
  [132, 108],
  [97, 99],
  [111, 95],
  [125, 99],
];

export function HarvestArt() {
  return (
    <svg viewBox="0 0 220 200" className="w-full max-w-xs mx-auto" focusable="false">
      {GRAPES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="pop fill-wine-red stroke-accent"
          style={cssVars({ "--delay": `${0.9 + i * 0.08}s` })}
          cx={x}
          cy={y}
          r="7"
          fillOpacity="0.85"
          strokeWidth="0.8"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.3s" })}
        d="M70 120 Q110 52 150 120"
        fill="none"
        strokeWidth="1.4"
      />
      <path className="draw stroke-accent" pathLength={1} d="M50 120 H170 L155 180 H65 Z" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.5s" })} d="M55 140 H165" fill="none" strokeWidth="0.9" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.6s" })} d="M60 160 H160" fill="none" strokeWidth="0.9" />
    </svg>
  );
}
