import type { WineListItem } from "../../types/wine";
import { WineCard } from "./WineCard";
import { WineCardSkeleton } from "../common/Skeleton";

type GridItem = WineListItem & { match_score?: number; explanation?: string[] };

export function WineGrid({ wines, skeletonCount = 0 }: { wines: GridItem[]; skeletonCount?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {wines.map((wine) => (
        <WineCard key={wine.id} wine={wine} matchScore={wine.match_score} explanation={wine.explanation} />
      ))}
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <WineCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
