import { Link } from "react-router-dom";
import type { WineListItem } from "../../types/wine";
import { formatPrice, formatVintage, primaryGrapeLabel, formatApproxUsd, hasApproxUsdConversion } from "../../utils/format";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='260'%3E%3Crect width='200' height='260' fill='%232f1b1e'/%3E%3C/svg%3E";

export function WineCard({
  wine,
  matchScore,
  explanation,
}: {
  wine: WineListItem;
  matchScore?: number;
  explanation?: string[];
}) {
  return (
    <Link
      to={`/wines/${wine.id}`}
      className="block border border-surface-border rounded overflow-hidden hover:border-accent"
    >
      <div className="relative">
        <img
          src={wine.image_url ?? PLACEHOLDER_IMAGE}
          alt={wine.name}
          className="w-full h-48 object-cover bg-surface-raised"
        />
        {matchScore !== undefined ? (
          <span className="absolute top-1.5 right-1.5 bg-accent text-surface text-xs font-bold px-2 py-0.5 rounded-full">
            {Math.round(matchScore * 100)}% Match
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <span className="inline-block text-xs uppercase tracking-wide text-accent mb-1">{wine.type}</span>
        <h3 className="font-serif text-base text-ink">{wine.name}</h3>
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
    </Link>
  );
}
