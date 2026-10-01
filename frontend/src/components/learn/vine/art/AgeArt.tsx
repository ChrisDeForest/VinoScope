import { cssVars } from "../../../home/art/cssVars";

export function AgeArt() {
  return (
    <svg viewBox="0 0 220 180" className="w-full max-w-xs mx-auto" focusable="false">
      <path className="draw stroke-accent" pathLength={1} d="M50 40 Q38 90 50 140 H170 Q182 90 170 40 Z" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.3s" })} d="M80 40 Q74 90 80 140" fill="none" strokeWidth="0.8" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.35s" })} d="M110 40 V140" fill="none" strokeWidth="0.8" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.4s" })} d="M140 40 Q146 90 140 140" fill="none" strokeWidth="0.8" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.7s" })} d="M46 60 Q110 66 174 60" fill="none" strokeWidth="1.4" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.8s" })} d="M46 120 Q110 114 174 120" fill="none" strokeWidth="1.4" />
      <path className="draw stroke-accent" pathLength={1} style={cssVars({ "--delay": "0.5s" })} d="M36 156 H184 M62 140 V156 M158 140 V156" fill="none" strokeWidth="1.4" />
      <circle className="pop fill-wine-red" style={cssVars({ "--delay": "1.1s" })} cx="110" cy="90" r="4" />
    </svg>
  );
}
