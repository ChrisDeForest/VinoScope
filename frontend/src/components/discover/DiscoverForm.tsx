import { useState, type FormEvent } from "react";
import type { RecommendationAnswers } from "../../types/wine";
import { TYPE_OPTIONS, TYPE_LABELS, COUNTRY_OPTIONS } from "../../constants/wineOptions";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { NumberStepperField } from "../common/NumberStepperField";
import { ComboBox } from "../common/ComboBox";
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
      <ComboBox
        id="discover-type"
        label="Wine type"
        value={typeof draft.type === "string" ? draft.type : ""}
        options={TYPE_OPTIONS.map((value) => ({ value, label: value === "" ? "No preference" : TYPE_LABELS[value] }))}
        onChange={(value) => update("type", value || undefined)}
        searchable={false}
      />

      <ComboBox
        id="discover-country"
        label="Country"
        value={typeof draft.country === "string" ? draft.country : ""}
        options={COUNTRY_OPTIONS.map((value) => ({ value, label: value === "" ? "No preference" : value }))}
        onChange={(value) => update("country", value || undefined)}
      />

      <div className="flex gap-2">
        <NumberStepperField id="discover-min-price" label="Min price" value={draft.min_price} onChange={(value) => update("min_price", value)} />
        <NumberStepperField id="discover-max-price" label="Max price" value={draft.max_price} onChange={(value) => update("max_price", value)} />
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
