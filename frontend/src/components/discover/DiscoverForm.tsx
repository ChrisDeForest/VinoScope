import { useState, type FormEvent } from "react";
import type { RecommendationAnswers } from "../../types/wine";
import { TYPE_OPTIONS, TYPE_LABELS, COUNTRY_OPTIONS } from "../../constants/wineOptions";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { PriceField } from "./PriceField";
import { DimensionField } from "./DimensionField";
import { priceRangeError } from "../../utils/priceRange";

export function DiscoverForm({
  initialAnswers,
  onSubmit,
  submitting = false,
  onReset,
}: {
  initialAnswers: RecommendationAnswers;
  onSubmit: (answers: RecommendationAnswers) => void;
  submitting?: boolean;
  onReset?: () => void;
}) {
  const [draft, setDraft] = useState<RecommendationAnswers>(initialAnswers);
  const [validationError, setValidationError] = useState<string | null>(null);

  function update<K extends keyof RecommendationAnswers>(key: K, value: RecommendationAnswers[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const error = priceRangeError(draft.min_price, draft.max_price);
    setValidationError(error);
    if (error) return;
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
        <PriceField id="discover-min-price" label="Min price" value={draft.min_price} onChange={(value) => update("min_price", value)} />
        <PriceField id="discover-max-price" label="Max price" value={draft.max_price} onChange={(value) => update("max_price", value)} />
      </div>

      {DIMENSIONS.map((dimension) => (
        <DimensionField
          key={dimension}
          dimension={dimension}
          value={draft[dimension]}
          onChange={(value) => update(dimension, value)}
        />
      ))}

      {validationError ? <p role="alert" className="text-sm text-ink">{validationError}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="bg-accent text-surface font-semibold px-6 py-3 rounded self-start disabled:opacity-50"
      >
        {submitting ? "Finding wines…" : "See My Recommendations"}
      </button>
      <button type="button" className="text-sm text-accent self-start hover:underline" onClick={() => {
        setDraft({});
        setValidationError(null);
        onReset?.();
      }}>Reset preferences</button>
    </form>
  );
}
