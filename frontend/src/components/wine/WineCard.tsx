import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddToCompareButton } from "../compare/AddToCompareButton";
import { WineImage } from "./WineImage";
import type { WineListItem } from "../../types/wine";
import { formatPrice, formatVintage, primaryGrapeLabel, formatApproxUsd, hasApproxUsdConversion } from "../../utils/format";

/** True when the reader has text selected inside `container` (a drag to copy, not a click to open). */
function hasSelectionWithin(container: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.toString().trim() === "") return false;
  return container.contains(selection.anchorNode) || container.contains(selection.focusNode);
}

export function WineCard({
  wine,
  matchScore,
  explanation,
  factorsCompared,
  factorsRequested,
  eagerImage = false,
}: {
  wine: WineListItem;
  matchScore?: number;
  explanation?: string[];
  factorsCompared?: number;
  factorsRequested?: number;
  eagerImage?: boolean;
}) {
  const navigate = useNavigate();
  const href = `/wines/${wine.id}`;

  // The whole card opens the wine, but only the name is a real link (for keyboard and screen
  // readers), so the rest of the text stays selectable: a drag that selects text doesn't navigate.
  function handleCardClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
    if (hasSelectionWithin(event.currentTarget)) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    navigate(href);
  }

  return (
    <div
      onClick={handleCardClick}
      className="flex flex-col border border-surface-border rounded overflow-hidden hover:border-accent cursor-pointer"
    >
      <div className="flex-1">
        <div className="relative">
          <WineImage src={wine.image_url} alt={wine.name} eager={eagerImage} className="w-full h-48" />
          {matchScore !== undefined ? (
            <span className="absolute top-1.5 right-1.5 bg-accent text-surface text-xs font-bold px-2 py-0.5 rounded-full">
              {Math.round(matchScore * 100)}% Match
            </span>
          ) : null}
        </div>
        <div className="p-3">
          {matchScore !== undefined && factorsCompared !== undefined ? (
            <p className="text-xs text-ink-muted mb-2">
              {factorsRequested === 0 ? "No taste factors selected" : `Based on ${factorsCompared} of ${factorsRequested ?? 5} taste factors`}
            </p>
          ) : null}
          <span className="inline-block text-xs uppercase tracking-wide text-accent mb-1">{wine.type}</span>
          <h3 className="font-serif text-base text-ink">
            {/* draggable={false} lets a drag across the name select its text instead of dragging the link. */}
            <Link to={href} draggable={false} className="hover:text-accent focus-visible:underline">
              {wine.name}
            </Link>
          </h3>
          <p className="text-sm text-ink-muted">
            {wine.winery} &middot; {formatVintage(wine.vintage)}
          </p>
          <p className="text-sm text-ink-muted">{[wine.region, wine.country].filter(Boolean).join(", ")}</p>
          <p className="text-sm text-ink-muted">{primaryGrapeLabel(wine.grapes)}</p>
          <p className="text-sm font-semibold text-ink mt-1">{formatPrice(wine.price, wine.currency)}</p>
          {hasApproxUsdConversion(wine.currency, wine.price_usd_approx) ? (
            <p className="text-xs text-ink-muted">{formatApproxUsd(wine.price_usd_approx)}</p>
          ) : null}
          {explanation && explanation.length > 0 ? (
            <p className="text-xs text-ink-muted mt-1">{explanation.slice(0, 3).join(" · ")}</p>
          ) : null}
        </div>
      </div>
      <div className="px-3 pb-3"><AddToCompareButton id={wine.id} name={wine.name} /></div>
    </div>
  );
}
