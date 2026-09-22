import type { WineListItem } from "../../types/wine";
import { WineCard } from "./WineCard";
import { WineCardSkeleton } from "../common/Skeleton";

export function WineGrid({ wines, skeletonCount = 0 }: { wines: WineListItem[]; skeletonCount?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {wines.map((wine) => (
        <WineCard key={wine.id} wine={wine} />
      ))}
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <WineCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
