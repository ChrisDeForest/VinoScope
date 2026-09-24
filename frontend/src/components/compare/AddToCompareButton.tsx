import { useCompareSelection } from "../../hooks/useCompareSelection";

export function AddToCompareButton({ id, name }: { id: number; name: string }) {
  const { selectedIds, addWine } = useCompareSelection();
  const selected = selectedIds.includes(id);
  const full = selectedIds.length >= 4;
  return (
    <button
      type="button"
      disabled={selected || full}
      aria-label={selected ? `${name} is in comparison` : full ? "Comparison full — remove a wine to add another" : `Add ${name} to compare`}
      onClick={() => addWine(id)}
      className="rounded border border-accent px-3 py-2 text-sm text-accent hover:bg-surface-raised disabled:opacity-60 disabled:cursor-default"
    >
      {selected ? "Added to Compare" : full ? "Comparison full (4/4)" : "Add to Compare"}
    </button>
  );
}
