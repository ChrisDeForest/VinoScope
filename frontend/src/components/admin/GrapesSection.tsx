import { useState } from "react";
import type { WineDetail, GrapeInput } from "../../types/wine";
import { updateGrapes } from "../../services/adminApi";
import { ApiError } from "../../services/api";
import { clearAdminKey } from "../../services/adminAuth";

export function GrapesSection({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  const [rows, setRows] = useState<{ name: string; percentage: string }[]>(
    wine.grapes.map((g) => ({ name: g.name, percentage: g.percentage === null ? "" : String(g.percentage) }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(index: number, field: "name" | "percentage", value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, { name: "", percentage: "" }]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const grapes: GrapeInput[] = rows
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({ name: row.name.trim(), percentage: row.percentage === "" ? null : Number(row.percentage) }));
    try {
      const updated = await updateGrapes(wine.id, grapes);
      onUpdated(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminKey();
        setError("Session expired — please refresh the page and log in again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to save grapes");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Grapes</h2>
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2 items-end">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Name
            <input
              aria-label={`Grape ${index + 1} name`}
              value={row.name}
              onChange={(e) => updateRow(index, "name", e.target.value)}
              className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Percentage
            <input
              aria-label={`Grape ${index + 1} percentage`}
              type="number"
              value={row.percentage}
              onChange={(e) => updateRow(index, "percentage", e.target.value)}
              className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink w-24"
            />
          </label>
          <button type="button" onClick={() => removeRow(index)} className="text-sm text-red-500 px-2 py-1">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="self-start text-sm text-accent">
        + Add grape
      </button>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="self-start bg-accent text-surface text-sm px-3 py-1 rounded disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save grapes"}
      </button>
    </div>
  );
}
