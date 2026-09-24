import type { WineDetail } from "../../types/wine";
import {
  formatPrice,
  formatApproxUsd,
  hasApproxUsdConversion,
  formatVintage,
  formatGrapeBreakdown,
} from "../../utils/format";

const CHARACTERISTIC_MAX = 5;

const CHARACTERISTIC_ROWS: {
  label: string;
  key: "sweetness" | "acidity" | "tannin" | "body" | "fruitiness";
}[] = [
  { label: "Sweetness", key: "sweetness" },
  { label: "Acidity", key: "acidity" },
  { label: "Tannin", key: "tannin" },
  { label: "Body", key: "body" },
  { label: "Fruitiness", key: "fruitiness" },
];

function CharacteristicCell({ value }: { value: number | null }) {
  const percent = value === null ? 0 : (value / CHARACTERISTIC_MAX) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-ink-muted w-16 shrink-0 text-right">{value === null ? "Not rated" : `${value}/5`}</span>
    </div>
  );
}

const ROW_LABEL_CLASS = "text-left text-ink-muted font-normal p-2 align-top";
const CELL_CLASS = "p-2 text-ink align-top";

export function CompareTable({ wines }: { wines: WineDetail[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm border-collapse break-words" style={{ minWidth: 112 + wines.length * 180 }}>
        <colgroup>
          <col style={{ width: 112 }} />
          {wines.map((wine) => <col key={wine.id} />)}
        </colgroup>
        <thead>
          <tr>
            <th className={ROW_LABEL_CLASS}>Field</th>
            {wines.map((wine) => (
              <th key={wine.id} className="text-left text-ink font-serif p-2">
                {wine.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Winery
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.winery}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Vintage
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {formatVintage(wine.vintage)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Type
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.type}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Country
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.country ?? "Unknown"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Region
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {[wine.region, wine.subregion].filter(Boolean).join(", ") || "Unknown"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Grape(s)
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {formatGrapeBreakdown(wine.grapes)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              Price
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {formatPrice(wine.price, wine.currency)}
                {hasApproxUsdConversion(wine.currency, wine.price_usd_approx) ? (
                  <span className="block text-xs text-ink-muted">{formatApproxUsd(wine.price_usd_approx)}</span>
                ) : null}
              </td>
            ))}
          </tr>
          <tr className="border-t border-surface-border">
            <th scope="row" className={ROW_LABEL_CLASS}>
              ABV
            </th>
            {wines.map((wine) => (
              <td key={wine.id} className={CELL_CLASS}>
                {wine.abv === null ? "Not listed" : `${wine.abv}%`}
              </td>
            ))}
          </tr>
          {CHARACTERISTIC_ROWS.map((row) => (
            <tr key={row.key} className="border-t border-surface-border">
              <th scope="row" className={ROW_LABEL_CLASS}>
                {row.label}
              </th>
              {wines.map((wine) => (
                <td key={wine.id} className="p-2 align-top">
                  <CharacteristicCell value={wine[row.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
