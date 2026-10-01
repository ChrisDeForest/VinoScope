import { Link } from "react-router-dom";
import type { WineStyle } from "../../../content/learn/vine";

const STYLE_LABEL: Record<WineStyle, string> = {
  red: "Red",
  white: "White",
  "rosé": "Rosé",
  sparkling: "Sparkling",
  fortified: "Fortified",
};

// Sparkling and fortified have no color token of their own; the written style name is always shown, so color is never the only signal.
const STYLE_BORDER: Record<WineStyle, string> = {
  red: "border-wine-red",
  white: "border-wine-white",
  "rosé": "border-wine-rose",
  sparkling: "border-wine-white",
  fortified: "border-wine-red",
};

export function StyleCallout({ style, text }: { style: WineStyle; text: string }) {
  const label = STYLE_LABEL[style];
  return (
    <div className={`rounded border-l-4 ${STYLE_BORDER[style]} bg-surface-raised px-3 py-2`}>
      <p className="text-sm text-ink">
        <span className="font-semibold">{label}:</span> {text}
      </p>
      <Link
        to={`/explore?type=${encodeURIComponent(style)}`}
        className="text-xs text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Explore {label.toLowerCase()} wines <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
