import { cssVars } from "../../../home/art/cssVars";

const SLATS = [90, 110, 130];

export function CrushArt() {
  return (
    <svg viewBox="0 0 220 210" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M50 30 V170 M170 30 V170 M40 30 H180" fill="none" strokeWidth="1.6" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.2s" })} d="M110 30 V62" fill="none" strokeWidth="1.4" />
      <path
        className="press stroke-accent"
        style={cssVars({ "--delay": "0.9s" })}
        d="M72 70 H148 V80 H72 Z"
        fill="none"
        strokeWidth="1.4"
      />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M70 86 V160 H150 V86" fill="none" strokeWidth="1.4" />
      {SLATS.map((x, i) => (
        <path
          key={x}
          className="draw stroke-accent"
          pathLength={1}
          style={cssVars({ "--delay": `${0.5 + i * 0.08}s` })}
          d={`M${x} 86 V160`}
          fill="none"
          strokeWidth="0.8"
        />
      ))}
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.7s" })} d="M58 182 H162" fill="none" strokeWidth="1.4" />
      <ellipse className="pop fill-wine-red" style={cssVars({ "--delay": "1.5s" })} cx="110" cy="176" rx="30" ry="5" fillOpacity="0.85" />
    </svg>
  );
}
