import { formatVintage } from "../../utils/format";
import type { WineDetail } from "../../types/wine";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='260'%3E%3Crect width='200' height='260' fill='%232f1b1e'/%3E%3C/svg%3E";

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
      <img
        src={wine.image_url ?? PLACEHOLDER_IMAGE}
        alt={wine.name}
        className="w-full h-32 object-cover bg-surface-raised"
      />
      <div className="p-2">
        <h3 className="font-serif text-sm text-ink">{wine.name}</h3>
        <p className="text-xs text-ink-muted">
          {wine.winery} &middot; {formatVintage(wine.vintage)}
        </p>
      </div>
    </div>
  );
}
