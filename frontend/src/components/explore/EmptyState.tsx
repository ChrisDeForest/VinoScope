export function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-ink-muted mb-2">No wines match your filters.</p>
      <button type="button" onClick={onClear} className="text-sm text-accent hover:underline">
        Clear filters
      </button>
    </div>
  );
}
