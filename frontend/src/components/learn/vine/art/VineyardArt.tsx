import { cssVars } from "../../../home/art/cssVars";

const POSTS: ReadonlyArray<readonly [x: number, base: number]> = [
  [40, 138],
  [80, 126],
  [120, 120],
  [160, 122],
  [200, 118],
];
const GRAPES: ReadonlyArray<readonly [x: number, y: number]> = [
  [60, 110],
  [100, 102],
  [140, 102],
  [180, 100],
];
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

export function VineyardArt() {
  return (
    <svg viewBox="0 0 240 180" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M0 150 Q80 104 160 128 T240 118" fill="none" strokeWidth="1.6" />
      {POSTS.map(([x, base], i) => (
        <path
          key={x}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.3 + i * 0.08}s` })}
          d={`M${x} ${base} V${base - 24}`}
          fill="none"
          strokeWidth="1.2"
        />
      ))}
      <path
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.8s" })}
        d="M40 114 Q60 102 80 102 Q100 94 120 96 Q140 92 160 98 Q180 92 200 94"
        fill="none"
        strokeWidth="1.2"
      />
      {GRAPES.map(([x, y], i) => (
        <circle
          key={x}
          className="pop fill-wine-red"
          style={cssVars({ "--delay": `${1.2 + i * 0.1}s` })}
          cx={x}
          cy={y}
          r="3.5"
        />
      ))}
      <circle className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.2s" })} cx="196" cy="40" r="14" fill="none" strokeWidth="1.2" />
      {RAYS.map((angle, i) => {
        const radians = (angle * Math.PI) / 180;
        const x1 = 196 + Math.cos(radians) * 20;
        const y1 = 40 + Math.sin(radians) * 20;
        const x2 = 196 + Math.cos(radians) * 27;
        const y2 = 40 + Math.sin(radians) * 27;
        return (
          <path
            key={angle}
            className="pop stroke-accent"
            style={cssVars({ "--delay": `${0.6 + i * 0.05}s` })}
            d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
            fill="none"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}
