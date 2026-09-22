export function FilterButton({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="border border-surface-border rounded px-4 py-2 text-sm text-ink">
      Filters{activeCount > 0 ? ` (${activeCount})` : ""}
    </button>
  );
}
