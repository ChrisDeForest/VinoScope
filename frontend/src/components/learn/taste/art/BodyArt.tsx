import { cssVars } from "../../../home/art/cssVars";

const GLASSES: ReadonlyArray<{ label: string; level: number; opacity: number }> = [
  { label: "Skim", level: 150, opacity: 0.35 },
  { label: "Whole", level: 120, opacity: 0.6 },
  { label: "Cream", level: 90, opacity: 0.9 },
];

export function BodyArt() {
  return (
    <svg viewBox="0 0 240 220" className="w-full max-w-sm mx-auto" focusable="false">
      {GLASSES.map(({ label, level, opacity }, i) => {
        const x = 20 + i * 75;
        return (
          <g key={label}>
            <rect
              className="fill-up fill-wine-white"
              style={cssVars({ "--delay": `${0.8 + i * 0.25}s` })}
              x={x + 9}
              y={level}
              width="42"
              height={188 - level}
              fillOpacity={opacity}
            />
            <path
              className="draw stroke-accent"
              pathLength={1}
              style={cssVars({ "--delay": `${i * 0.15}s` })}
              d={`M${x} 60 L${x + 8} 190 H${x + 52} L${x + 60} 60`}
              fill="none"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <text x={x + 30} y="208" textAnchor="middle" fontSize="10" className="fill-ink-muted">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
