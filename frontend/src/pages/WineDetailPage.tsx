import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ApiError } from "../services/api";
import { getCachedWine } from "../services/wineCache";
import { useApiQuery } from "../hooks/useApiQuery";
import { CharacteristicBar } from "../components/wine/CharacteristicBar";
import { RetailerListingRow } from "../components/wine/RetailerListingRow";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { Skeleton } from "../components/common/Skeleton";
import { formatVintage } from "../utils/format";
import { getAdminKey } from "../services/adminAuth";
import { WineEditPanel } from "../components/admin/WineEditPanel";
import { AddToCompareButton } from "../components/compare/AddToCompareButton";
import { WineImage } from "../components/wine/WineImage";
import type { WineDetail } from "../types/wine";

export function WineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wineId = Number(id);

  const { data, loading, error } = useApiQuery(() => getCachedWine(wineId), [wineId]);
  const [edited, setEdited] = useState<WineDetail | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEdited(null);
    setEditing(false);
  }, [data]);

  const wine = edited ?? data;

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-8">
        <Skeleton className="w-full md:w-80 h-96" />
        <div className="flex-1 flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="text-center py-12">
        <h1 className="font-serif text-2xl text-ink mb-2">Wine not found</h1>
        <Link to="/explore" className="text-accent hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  if (error || !data || !wine) {
    return <ErrorMessage message="Couldn't load this wine. Please try again." />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <WineImage src={wine.image_url} alt={wine.name} eager className="w-full md:w-80 h-96 rounded shrink-0" />

      <div className="flex-1 flex flex-col gap-4">
        <div>
          <span className="inline-block text-xs uppercase tracking-wide text-accent mb-1">{wine.type}</span>
          <h1 className="font-serif text-2xl text-ink">{wine.name}</h1>
          <p className="text-ink-muted">
            {wine.winery} &middot; {formatVintage(wine.vintage)}
          </p>
          <p className="text-ink-muted">{[wine.region, wine.subregion, wine.country].filter(Boolean).join(", ")}</p>
          {getAdminKey() ? (
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="text-sm text-accent hover:underline mt-1"
            >
              {editing ? "Close editor" : "Edit this wine"}
            </button>
          ) : null}
        </div>

        {editing ? <WineEditPanel wine={wine} onUpdated={setEdited} /> : null}
        <div><AddToCompareButton id={wine.id} name={wine.name} /></div>

        <div className="flex flex-col gap-2">
          <CharacteristicBar label="Sweetness" value={wine.sweetness} />
          <CharacteristicBar label="Acidity" value={wine.acidity} />
          <CharacteristicBar label="Tannin" value={wine.tannin} />
          <CharacteristicBar label="Body" value={wine.body} />
          <CharacteristicBar label="Fruitiness" value={wine.fruitiness} />
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">Grapes</h2>
          <p className="text-ink">
            {wine.grapes.length === 0
              ? "Not specified"
              : wine.grapes
                  .map((g) => (g.percentage === null ? g.name : `${g.name} (${g.percentage}%)`))
                  .join(", ")}
          </p>
        </div>

        {wine.abv !== null ? <p className="text-ink-muted text-sm">ABV: {wine.abv}%</p> : null}

        {wine.description ? <p className="text-ink">{wine.description}</p> : null}

        <div>
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">Retailers</h2>
          {wine.listings.length === 0 ? (
            <p className="text-ink-muted text-sm">No retailers currently listed.</p>
          ) : (
            wine.listings.map((listing) => <RetailerListingRow key={listing.id} listing={listing} />)
          )}
        </div>
      </div>
    </div>
  );
}
