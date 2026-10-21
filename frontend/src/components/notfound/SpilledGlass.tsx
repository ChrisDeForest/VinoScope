import { cssVars } from "../home/art/cssVars";
import "./notfound.css";

// Same bowl as components/home/art/Glass.tsx, in its 200×220 space.
const BOWL = "M60 20 C55 80 60 120 100 135 C140 120 145 80 140 20";

// The home page's gold glass, knocked over: it draws in, tips right and spills.
export function SpilledGlass({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox="0 0 420 220"
      className={`spilled-glass w-full max-w-sm h-auto ${animate ? "" : "is-static"}`}
      aria-hidden="true"
    >
      <ellipse className="spill fill-wine-red" cx="345" cy="207" rx="66" ry="6" fillOpacity="0.85" />
      <g transform="translate(40,14)">
        <g className="tip">
          <path className="draw stroke-accent" pathLength={1} d={BOWL} fill="none" strokeWidth="1.6" strokeLinecap="round" />
          <path
            className="draw stroke-accent"
            pathLength={1}
            style={cssVars({ "--delay": "0.3s" })}
            d="M100 135 V195"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            className="draw stroke-accent"
            pathLength={1}
            style={cssVars({ "--delay": "0.5s" })}
            d="M70 198 H130"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
