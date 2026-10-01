import { cssVars } from "../../../home/art/cssVars";

const SEEDS: ReadonlyArray<readonly [x: number, y: number]> = [
  [160, 112],
  [178, 118],
  [168, 132],
];

export function TanninArt() {
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-xs mx-auto" focusable="false">
      <path
        className="pop fill-wine-red"
        style={cssVars({ "--delay": "0.9s" })}
        fillOpacity="0.55"
        d="M34 80 H106 V100 Q106 136 70 136 Q34 136 34 100 Z"
      />
      <path className="draw stroke-accent" pathLength={1} d="M30 70 H110 V100 Q110 140 70 140 Q30 140 30 100 Z" fill="none" strokeWidth="1.6" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.3s" })}
        d="M110 82 q20 0 20 16 q0 16 -20 16"
        fill="none"
        strokeWidth="1.4"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M20 150 H120" fill="none" strokeWidth="1.4" />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.5s" })}
        d="M150 60 q30 -10 45 10 q-10 25 -40 20 q-12 -12 -5 -30 z"
        fill="none"
        strokeWidth="1.2"
      />
      {SEEDS.map(([x, y], i) => (
        <ellipse
          key={`${x}-${y}`}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.7 + i * 0.1}s` })}
          cx={x}
          cy={y}
          rx="4"
          ry="6"
          fill="none"
          strokeWidth="1"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.8s" })}
        d="M130 205 q0 -40 40 -40 q40 0 40 40"
        fill="none"
        strokeWidth="1.4"
      />
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "1.4s" })}
        d="M142 195 q7 -6 14 0 t14 0 t14 0 t14 0"
        fill="none"
        strokeWidth="1"
      />
    </svg>
  );
}
