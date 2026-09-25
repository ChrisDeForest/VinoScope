import { useId } from "react";
import { cssVars } from "./cssVars";

export type WineColor = "red" | "white" | "rose";
export type FillLevel = "low" | "mid" | "high";

const BOWL = "M60 20 C55 80 60 120 100 135 C140 120 145 80 140 20";
const LEVEL_Y: Record<FillLevel, number> = { low: 100, mid: 82, high: 64 };
const WINE_FILL: Record<WineColor, string> = { red: "fill-wine-red", white: "fill-wine-white", rose: "fill-wine-rose" };
const WINE_STROKE: Record<WineColor, string> = { red: "stroke-wine-red", white: "stroke-wine-white", rose: "stroke-wine-rose" };

// Gold line-art wine glass in a 200×220 coordinate space. The outline draws
// in, then the wine fades up inside a clip of the bowl.
export function Glass({ wine, level, surfaceClassName = "" }: { wine: WineColor; level: FillLevel; surfaceClassName?: string }) {
  const clipId = `glass-bowl-${useId().replace(/:/g, "")}`;
  const y = LEVEL_Y[level];

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={`${BOWL} Z`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} className="pop" style={cssVars({ "--delay": "0.9s" })}>
        <rect x="40" y={y} width="120" height={140 - y} className={WINE_FILL[wine]} fillOpacity="0.85" />
        <path
          className={`${WINE_STROKE[wine]} ${surfaceClassName}`}
          d={`M52 ${y} Q100 ${y + 7} 148 ${y}`}
          fill="none"
          strokeWidth="2"
        />
      </g>
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
  );
}
