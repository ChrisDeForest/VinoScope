import { cssVars } from "../../../home/art/cssVars";

const SEGMENT_ENDS: ReadonlyArray<readonly [x: number, y: number]> = [
  [58.4, 106],
  [76, 88.4],
  [100, 82],
  [124, 88.4],
  [141.6, 106],
];
const DROPS: ReadonlyArray<readonly [x: number, y: number]> = [
  [52, 62],
  [80, 44],
  [120, 44],
  [148, 62],
  [170, 92],
];

export function AcidityArt() {
  return (
    <svg viewBox="0 0 200 180" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M40 130 A60 60 0 0 1 160 130 Z" fill="none" strokeWidth="1.6" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.3s" })}
        d="M52 130 A48 48 0 0 1 148 130"
        fill="none"
        strokeWidth="1"
      />
      {SEGMENT_ENDS.map(([x, y], i) => (
        <path
          key={`${x}-${y}`}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.5 + i * 0.08}s` })}
          d={`M100 130 L${x} ${y}`}
          fill="none"
          strokeWidth="0.8"
        />
      ))}
      {DROPS.map(([x, y], i) => (
        <path
          key={`${x}-${y}`}
          className="pop stroke-accent"
          style={cssVars({ "--delay": `${1.2 + i * 0.12}s` })}
          d={`M${x} ${y} q-5 8 0 12 q5 -4 0 -12 z`}
          fill="none"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
