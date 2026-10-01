import { Link } from "react-router-dom";
import { Skeleton } from "../../common/Skeleton";
import { WineImage } from "../../wine/WineImage";
import type { WineListItem } from "../../../types/wine";
import { DIMENSION_TITLES, type Dimension } from "../../../utils/dimensionLabels";
import type { PairTone } from "./DimensionScale";

interface ExampleWineCardProps {
  wine: WineListItem;
  dimension: Dimension;
  tone: PairTone;
  reason: string;
}

export function ExampleWineCard({ wine, dimension, tone, reason }: ExampleWineCardProps) {
  return (
    <Link
      to={`/wines/${wine.id}`}
      className="flex gap-3 rounded border border-surface-border p-3 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <WineImage src={wine.image_url} alt="" className="h-24 w-16 shrink-0 rounded" />
      <span className="min-w-0">
        <span className="block text-xs uppercase tracking-wide text-accent">{tone === "low" ? "Low" : "High"}</span>
        <span className="block font-serif text-ink">{wine.name}</span>
        <span className="block text-sm text-ink-muted">
          {wine.type}
          {wine.country ? ` · ${wine.country}` : ""}
        </span>
        <span className="block text-sm text-ink">
          {DIMENSION_TITLES[dimension]} {wine[dimension] ?? "–"} / 5
        </span>
        <span className="block text-sm text-ink-muted mt-1">{reason}</span>
      </span>
    </Link>
  );
}

export function ExampleWineCardSkeleton() {
  return (
    <div className="flex gap-3 rounded border border-surface-border p-3">
      <Skeleton className="h-24 w-16 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
