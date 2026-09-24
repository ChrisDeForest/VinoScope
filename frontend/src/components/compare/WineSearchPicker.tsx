import { useRef, useState, type FormEvent } from "react";
import { ApiError, listWines } from "../../services/api";
import type { WineListItem } from "../../types/wine";
import { formatPrice, formatVintage } from "../../utils/format";

const RESULT_LIMIT = 8;

export function WineSearchPicker({
  excludeIds,
  onSelect,
}: {
  excludeIds: number[];
  onSelect: (id: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<WineListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const requestIdRef = useRef(0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = draft.trim();
    if (!query) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await listWines({ q: query, limit: RESULT_LIMIT });
      if (requestId !== requestIdRef.current) return;
      setResults(response.items);
      setSearched(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof ApiError ? err.message : "Failed to search wines");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }

  const visibleResults = results.filter((wine) => !excludeIds.includes(wine.id));

  return (
    <div className="border border-dashed border-surface-border rounded p-3 flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="compare-search" className="sr-only">
          Search wines to compare
        </label>
        <input
          id="compare-search"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search wine or winery"
          className="flex-1 min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={loading || draft.trim() === ""}
          className="text-sm bg-accent text-surface rounded px-3 py-1 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {error ? <p className="text-sm text-ink-muted">{error}</p> : null}

      {searched && !loading && !error && visibleResults.length === 0 ? (
        <p className="text-sm text-ink-muted">No wines found.</p>
      ) : null}

      {visibleResults.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {visibleResults.map((wine) => (
            <li key={wine.id}>
              <button
                type="button"
                onClick={() => onSelect(wine.id)}
                className="w-full text-left text-sm border border-surface-border rounded px-2 py-1 hover:border-accent"
              >
                <span className="text-ink">{wine.name}</span>{" "}
                <span className="text-ink-muted">
                  &middot; {wine.winery} &middot; {formatVintage(wine.vintage)} &middot;{" "}
                  {formatPrice(wine.price, wine.currency)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
