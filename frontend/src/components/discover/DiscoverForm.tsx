import { useState, type FormEvent } from "react";
import type { RecommendationAnswers } from "../../types/wine";
import { TYPE_OPTIONS, TYPE_LABELS, COUNTRY_OPTIONS } from "../../constants/wineOptions";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { DimensionField } from "./DimensionField";

export function DiscoverForm({
  initialAnswers,
  onSubmit,
  submitting = false,
}: {
  initialAnswers: RecommendationAnswers;
  onSubmit: (answers: RecommendationAnswers) => void;
  submitting?: boolean;
}) {
  const [draft, setDraft] = useState<RecommendationAnswers>(initialAnswers);

  function update<K extends keyof RecommendationAnswers>(key: K, value: RecommendationAnswers[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xl">
      <div className="flex flex-col gap-1">
        <label htmlFor="discover-type" className="text-sm text-ink-muted">
          Wine type
        </label>
        <select
          id="discover-type"
          value={draft.type ?? ""}
          onChange={(e) => update("type", e.target.value || undefined)}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        >
          {TYPE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value === "" ? "No preference" : TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="discover-country" className="text-sm text-ink-muted">
          Country
        </label>
        <select
          id="discover-country"
          value={draft.country ?? ""}
          onChange={(e) => update("country", e.target.value || undefined)}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        >
          {COUNTRY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value === "" ? "No preference" : value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="discover-min-price" className="text-sm text-ink-muted">
            Min price
          </label>
          <input
            id="discover-min-price"
            type="number"
            min={0}
            value={draft.min_price ?? ""}
            onChange={(e) => update("min_price", e.target.value === "" ? undefined : Number(e.target.value))}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="discover-max-price" className="text-sm text-ink-muted">
            Max price
          </label>
          <input
            id="discover-max-price"
            type="number"
            min={0}
            value={draft.max_price ?? ""}
            onChange={(e) => update("max_price", e.target.value === "" ? undefined : Number(e.target.value))}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </div>
      </div>

      {DIMENSIONS.map((dimension) => (
        <DimensionField
          key={dimension}
          dimension={dimension}
          value={draft[dimension]}
          onChange={(value) => update(dimension, value)}
        />
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="bg-accent text-surface font-semibold px-6 py-3 rounded self-start disabled:opacity-50"
      >
        {submitting ? "Finding wines…" : "See My Recommendations"}
      </button>
    </form>
  );
}
