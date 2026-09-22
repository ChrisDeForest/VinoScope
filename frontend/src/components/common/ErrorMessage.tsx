export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-surface-border rounded p-4 text-center">
      <p className="text-ink-muted mb-2">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="text-sm text-accent hover:underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}
