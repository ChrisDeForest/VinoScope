import type { WineDetail } from "../../types/wine";
import { WineFieldsSection } from "./WineFieldsSection";
import { ListingsSection } from "./ListingsSection";
import { GrapesSection } from "./GrapesSection";

export function WineEditPanel({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  return (
    <div className="flex flex-col gap-6 border border-surface-border rounded p-4">
      <WineFieldsSection wine={wine} onUpdated={onUpdated} />
      <ListingsSection wine={wine} onUpdated={onUpdated} />
      <GrapesSection wine={wine} onUpdated={onUpdated} />
    </div>
  );
}
