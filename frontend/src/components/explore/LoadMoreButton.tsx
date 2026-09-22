export function LoadMoreButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mx-auto block border border-surface-border rounded px-6 py-2 text-sm text-ink disabled:opacity-50"
    >
      {loading ? "Loading..." : "Load more"}
    </button>
  );
}
