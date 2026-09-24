import type { WineListItem } from "../../types/wine";
import { WineCard } from "./WineCard";
import { WineCardSkeleton } from "../common/Skeleton";

type GridItem = WineListItem & { match_score?: number; explanation?: string[]; factors_compared?: number; factors_requested?: number };

export function WineGrid({ wines, skeletonCount = 0 }: { wines: GridItem[]; skeletonCount?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {wines.map((wine, index) => (
        <WineCard key={wine.id} wine={wine} matchScore={wine.match_score} explanation={wine.explanation}
          factorsCompared={wine.factors_compared} factorsRequested={wine.factors_requested} eagerImage={index < 3} />
      ))}
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <WineCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
