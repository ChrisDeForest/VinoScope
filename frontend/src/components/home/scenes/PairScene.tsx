import { FOOD_PAIRINGS, type FoodKey } from "../../../constants/foodPairings";
import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const SAMPLE_FOODS: FoodKey[] = ["steak", "salmon", "aged_cheese"];

function PairArt() {
  return (
    <svg viewBox="0 0 260 220" className="w-full max-w-md mx-auto" focusable="false">
      <Glass wine="red" level="mid" />
      <g className="slide" style={cssVars({ "--from-x": "40px", "--delay": "0.7s" })}>
        <ellipse cx="205" cy="172" rx="46" ry="13" className="stroke-accent" fill="none" strokeWidth="1.4" />
        <ellipse cx="205" cy="170" rx="30" ry="8" className="stroke-accent" fill="none" strokeWidth="0.8" />
      </g>
      <path
        className="pop stroke-accent"
        style={cssVars({ "--delay": "1.3s" })}
        d="M142 110 Q178 120 192 152"
        fill="none"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
    </svg>
  );
}

export function PairScene() {
  return (
    <Scene id="pair" index={3} label="Pair" title="Match the bottle to the plate." side="left" art={<PairArt />}>
      <p className="text-ink-muted mb-6">
        Tell us what's for dinner and we'll find wines whose sweetness, acidity, tannin, and body suit it.
      </p>
      <ul className="flex flex-wrap gap-2 mb-6">
        {SAMPLE_FOODS.map((key, i) => (
          <li
            key={key}
            className="pop rounded-full border border-surface-border px-3 py-1 text-sm text-ink"
            style={cssVars({ "--delay": `${1.1 + i * 0.15}s` })}
          >
            {FOOD_PAIRINGS[key].label}
          </li>
        ))}
      </ul>
      <SceneCta to="/pair">Pair With Food</SceneCta>
    </Scene>
  );
}
