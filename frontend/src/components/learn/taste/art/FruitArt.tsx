import { cssVars } from "../../../home/art/cssVars";

const BERRIES: ReadonlyArray<readonly [x: number, y: number]> = [
  [110, 80],
  [92, 96],
  [128, 96],
  [110, 112],
  [74, 112],
  [146, 112],
  [92, 128],
  [128, 128],
  [110, 144],
  [100, 160],
  [120, 160],
  [110, 176],
];

export function FruitArt() {
  return (
    <svg viewBox="0 0 220 200" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M110 70 V40 q10 -14 30 -14" fill="none" strokeWidth="1.4" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.2s" })}
        d="M140 26 q20 -16 40 -6 q-4 22 -26 26 q-12 -4 -14 -20 z"
        fill="none"
        strokeWidth="1.2"
      />
      {BERRIES.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className="pop fill-wine-red stroke-accent"
          style={cssVars({ "--delay": `${0.5 + i * 0.12}s` })}
          cx={x}
          cy={y}
          r="9"
          fillOpacity="0.8"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}
