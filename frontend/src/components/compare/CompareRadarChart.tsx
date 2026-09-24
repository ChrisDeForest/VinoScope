import { useRef } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import type { WineDetail } from "../../types/wine";

const AXES: { key: "sweetness" | "acidity" | "tannin" | "body" | "fruitiness"; label: string }[] = [
  { key: "sweetness", label: "Sweetness" },
  { key: "acidity", label: "Acidity" },
  { key: "tannin", label: "Tannin" },
  { key: "body", label: "Body" },
  { key: "fruitiness", label: "Fruitiness" },
];

const SERIES: { color: string; dash?: string }[] = [
  { color: "#3987e5" },
  { color: "#d95926", dash: "6 3" },
  { color: "#199e70", dash: "2 2" },
  { color: "#9085e9", dash: "8 3 2 3" },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#231416",
  border: "1px solid #4a262b",
  borderRadius: 4,
  color: "#e8dcc8",
  fontSize: 12,
};

function seriesKey(wineId: number): string {
  return `wine_${wineId}`;
}

function buildRadarData(wines: WineDetail[]): Record<string, string | number>[] {
  return AXES.map((axis) => {
    const row: Record<string, string | number> = { characteristic: axis.label };
    for (const wine of wines) {
      row[seriesKey(wine.id)] = wine[axis.key]!;
    }
    return row;
  });
}

export function CompareRadarChart({ wines }: { wines: WineDetail[] }) {
  const styles = useRef(new Map<number, number>()).current;
  for (const id of styles.keys()) {
    if (!wines.some((wine) => wine.id === id)) styles.delete(id);
  }
  for (const wine of [...wines].sort((a, b) => a.id - b.id)) {
    if (!styles.has(wine.id)) {
      styles.set(wine.id, SERIES.findIndex((_, index) => ![...styles.values()].includes(index)));
    }
  }
  const completeWines = wines.filter((wine) => AXES.every((axis) => wine[axis.key] !== null));
  const data = buildRadarData(completeWines);
  const hasMissingValue = completeWines.length !== wines.length;

  return (
    <div className="flex flex-col items-center gap-4 text-ink">
      <div className="w-full max-w-[640px] h-[360px] sm:h-[480px]" aria-label="Wine characteristics chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <RadarChart data={data} outerRadius="65%">
        <PolarGrid stroke="currentColor" strokeOpacity={0.3} />
        <PolarAngleAxis dataKey="characteristic" tick={{ fill: "currentColor", fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
        {completeWines.map((wine) => {
          const series = SERIES[styles.get(wine.id)!];
          return (
            <Radar
              key={wine.id}
              name={wine.name}
              dataKey={seriesKey(wine.id)}
              stroke={series.color}
              strokeDasharray={series.dash}
              strokeWidth={2}
              fill={series.color}
              fillOpacity={0.15}
            />
          );
        })}
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
      </ResponsiveContainer>
      </div>
      <ul aria-label="Compared wines" className="grid w-full max-w-[640px] grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-4 text-sm">
        {wines.map((wine) => (
          <li key={wine.id} className="flex items-start gap-2 min-w-0">
            <svg width="28" height="16" className="shrink-0 mt-0.5" aria-hidden="true">
              <line x1="0" x2="28" y1="8" y2="8" stroke={SERIES[styles.get(wine.id)!].color} strokeWidth="3" strokeDasharray={SERIES[styles.get(wine.id)!].dash} />
            </svg>
            <span className="break-words min-w-0">{wine.name}
              {AXES.some((axis) => wine[axis.key] === null) ? (
                <span className="block text-xs text-ink-muted">Not plotted: missing {AXES.filter((axis) => wine[axis.key] === null).map((axis) => axis.label).join(", ")}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {hasMissingValue ? <p className="text-xs text-ink-muted">Only wines with all five ratings are plotted. See the table for available ratings.</p> : null}
    </div>
  );
}
