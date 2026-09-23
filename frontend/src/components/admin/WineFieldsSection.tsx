import { useState } from "react";
import type { WineDetail, WineUpdatePayload } from "../../types/wine";
import { updateWine } from "../../services/adminApi";
import { ApiError } from "../../services/api";
import { clearAdminKey } from "../../services/adminAuth";

const WINE_TYPES = ["red", "white", "rosé", "sparkling", "dessert", "fortified"];
const RATING_DIMENSIONS = ["sweetness", "acidity", "tannin", "body", "fruitiness"] as const;
const NULLABLE_TEXT_FIELDS = new Set(["country", "region", "subregion", "description", "image_url"]);

export function WineFieldsSection({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  const [form, setForm] = useState({
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    type: wine.type,
    country: wine.country ?? "",
    region: wine.region ?? "",
    subregion: wine.subregion ?? "",
    abv: wine.abv,
    sweetness: wine.sweetness,
    acidity: wine.acidity,
    tannin: wine.tannin,
    body: wine.body,
    fruitiness: wine.fruitiness,
    description: wine.description ?? "",
    image_url: wine.image_url ?? "",
  });
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty((prev) => new Set(prev).add(field as string));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload: WineUpdatePayload = {};
    for (const field of dirty) {
      let value = (form as Record<string, unknown>)[field];
      if (value === "" && NULLABLE_TEXT_FIELDS.has(field)) {
        value = null;
      }
      (payload as Record<string, unknown>)[field] = value;
    }
    try {
      const updated = await updateWine(wine.id, payload);
      onUpdated(updated);
      setDirty(new Set());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminKey();
        setError("Session expired — please refresh the page and log in again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to save wine");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink";

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Wine details</h2>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Name
        <input value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Winery
        <input value={form.winery} onChange={(e) => update("winery", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Vintage
        <input
          type="number"
          value={form.vintage ?? ""}
          onChange={(e) => update("vintage", e.target.value === "" ? null : Number(e.target.value))}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Type
        <select value={form.type} onChange={(e) => update("type", e.target.value)} className={inputClass}>
          {WINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Country
        <input value={form.country} onChange={(e) => update("country", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Region
        <input value={form.region} onChange={(e) => update("region", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Subregion
        <input
          value={form.subregion}
          onChange={(e) => update("subregion", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        ABV
        <input
          type="number"
          value={form.abv ?? ""}
          onChange={(e) => update("abv", e.target.value === "" ? null : Number(e.target.value))}
          className={inputClass}
        />
      </label>
      {RATING_DIMENSIONS.map((dim) => (
        <label key={dim} className="flex flex-col gap-1 text-sm text-ink-muted capitalize">
          {dim}
          <input
            type="number"
            min={1}
            max={5}
            value={form[dim] ?? ""}
            onChange={(e) => update(dim, e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
          />
        </label>
      ))}
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Description
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Image URL
        <input
          value={form.image_url}
          onChange={(e) => update("image_url", e.target.value)}
          className={inputClass}
        />
      </label>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={dirty.size === 0 || saving}
        className="self-start bg-accent text-surface text-sm px-3 py-1 rounded disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save wine"}
      </button>
    </div>
  );
}
