import { formatVintage } from "../../utils/format";
import { WineImage } from "../wine/WineImage";
import type { WineDetail } from "../../types/wine";

export function CompareSlot({ wine, onRemove }: { wine: WineDetail; onRemove: () => void }) {
  return (
    <div className="relative border border-surface-border rounded overflow-hidden">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${wine.name}`}
        className="absolute top-1.5 right-1.5 bg-surface text-ink-muted hover:text-ink rounded-full w-6 h-6 flex items-center justify-center"
      >
        &times;
      </button>
      <WineImage src={wine.image_url} alt={wine.name} className="w-full h-32" />
      <div className="p-2">
        <h3 className="font-serif text-sm text-ink">{wine.name}</h3>
        <p className="text-xs text-ink-muted">
          {wine.winery} &middot; {formatVintage(wine.vintage)}
        </p>
      </div>
    </div>
  );
}
