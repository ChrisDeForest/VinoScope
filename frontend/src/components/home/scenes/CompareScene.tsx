import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const RADAR_CENTER = { x: 120, y: 190 };
const RADAR_RADIUS = 24;
const OUTLINE = [1, 1, 1, 1, 1];
const SHAPE_A = [0.8, 0.5, 0.6, 0.3, 0.7];
const SHAPE_B = [0.4, 0.8, 0.5, 0.6, 0.4];

function pentagonPoints(values: readonly number[]): string {
  return values
    .map((value, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
      const x = RADAR_CENTER.x + Math.cos(angle) * RADAR_RADIUS * value;
      const y = RADAR_CENTER.y + Math.sin(angle) * RADAR_RADIUS * value;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function CompareArt() {
  return (
    <svg viewBox="0 0 240 220" className="w-full max-w-sm mx-auto" focusable="false">
      <g transform="translate(20 0) scale(0.8)">
        <g className="slide" style={cssVars({ "--from-x": "50px", "--delay": "0.5s" })}>
          <Glass wine="red" level="high" />
        </g>
      </g>
      <g transform="translate(92 0) scale(0.8)">
        <g className="slide" style={cssVars({ "--from-x": "-50px", "--delay": "0.5s" })}>
          <Glass wine="white" level="mid" />
        </g>
      </g>
      <polygon
        className="draw stroke-accent"
        pathLength={1}
        style={cssVars({ "--delay": "0.9s" })}
        points={pentagonPoints(OUTLINE)}
        fill="none"
        strokeWidth="0.8"
      />
      <polygon className="radar-a fill-wine-red" style={cssVars({ "--delay": "1.4s" })} points={pentagonPoints(SHAPE_A)} fillOpacity="0.55" />
      <polygon className="radar-b fill-wine-white" style={cssVars({ "--delay": "1.4s" })} points={pentagonPoints(SHAPE_B)} fillOpacity="0.55" />
    </svg>
  );
}

export function CompareScene() {
  return (
    <Scene id="compare" index={4} label="Compare" title="Taste two wines side by side." side="right" art={<CompareArt />}>
      <p className="text-ink-muted mb-6">
        Put up to four wines next to each other — price, region, grapes, and a taste radar that shows where they
        differ.
      </p>
      <SceneCta to="/compare">Compare Wines</SceneCta>
    </Scene>
  );
}
