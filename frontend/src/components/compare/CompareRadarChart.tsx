import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts";
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
      row[seriesKey(wine.id)] = wine[axis.key] ?? 0;
    }
    return row;
  });
}

export function CompareRadarChart({ wines }: { wines: WineDetail[] }) {
  const data = buildRadarData(wines);
  const hasMissingValue = wines.some((wine) => AXES.some((axis) => wine[axis.key] === null));

  return (
    <div className="flex flex-col items-center gap-2 text-ink">
      <RadarChart width={320} height={320} data={data} outerRadius="70%">
        <PolarGrid stroke="currentColor" strokeOpacity={0.3} />
        <PolarAngleAxis dataKey="characteristic" tick={{ fill: "currentColor", fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
        {wines.map((wine, index) => {
          const series = SERIES[index];
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
        <Legend />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
      {hasMissingValue ? <p className="text-xs text-ink-muted">Missing characteristics are plotted as 0.</p> : null}
    </div>
  );
}
