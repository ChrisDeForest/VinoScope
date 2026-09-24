import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, listWines } from "../services/api";
import type { SortOption, WineListItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { FilterButton } from "../components/explore/FilterButton";
import { FilterDrawer } from "../components/explore/FilterDrawer";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { EmptyState } from "../components/explore/EmptyState";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { TYPE_LABELS } from "../constants/wineOptions";
import {
  DEFAULT_FILTERS,
  FILTER_PARAM_NAMES,
  SORT_OPTIONS,
  countActiveFilters,
  filtersToApiParams,
  filtersToSearchParams,
  filtersFromSearchParams,
  type FilterValues,
} from "../components/explore/filterTypes";
import { readPageState, writePageState } from "../utils/pageState";

const CHIP_LABELS: { key: keyof FilterValues; name: string; describe: (value: string) => string }[] = [
  { key: "q", name: "search", describe: (value) => `Search: "${value}"` },
  { key: "type", name: "type", describe: (value) => `Type: ${TYPE_LABELS[value] ?? value}` },
  { key: "country", name: "country", describe: (value) => `Country: ${value}` },
  { key: "grape", name: "grape", describe: (value) => `Grape: ${value}` },
  { key: "minPrice", name: "min price", describe: (value) => `Min price: $${value}` },
  { key: "maxPrice", name: "max price", describe: (value) => `Max price: $${value}` },
];

const PAGE_SIZE = 12;
const STATE_KEY = "vinoscope-explore-state";
const SCROLL_KEY = "vinoscope-explore-scroll";

interface ExploreSnapshot {
  filtersKey: string;
  items: WineListItem[];
  total: number;
}

function filtersKeyOf(filters: FilterValues): string {
  return filtersToSearchParams(filters).toString();
}

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [initial] = useState(() => {
    const filters = filtersFromSearchParams(searchParams);
    const snapshot = readPageState<ExploreSnapshot>(STATE_KEY);
    const hit = snapshot !== null && snapshot.filtersKey === filtersKeyOf(filters);
    const scrollY = hit ? readPageState<number>(SCROLL_KEY) ?? 0 : 0;
    return { filters, hit, snapshot, scrollY };
  });

  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(initial.filters);
  const [searchDraft, setSearchDraft] = useState(initial.filters.q);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<WineListItem[]>(initial.hit ? initial.snapshot!.items : []);
  const [total, setTotal] = useState(initial.hit ? initial.snapshot!.total : 0);
  const [loading, setLoading] = useState(!initial.hit);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreRequestId = useRef(0);
  const primaryRequestId = useRef(0);
  const skipNextFetchRef = useRef(initial.hit);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    return () => {
      loadMoreRequestId.current += 1;
      primaryRequestId.current += 1;
    };
  }, []);

  useEffect(() => {
    // Only the known filter keys are ours to manage -- any other query param (a
    // tracking tag on a shared link, etc.) arrived from outside and must survive.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        FILTER_PARAM_NAMES.forEach((name) => next.delete(name));
        filtersToSearchParams(appliedFilters).forEach((value, name) => next.set(name, value));
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  useEffect(() => {
    setSearchDraft(appliedFilters.q);
  }, [appliedFilters.q]);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const requestId = ++primaryRequestId.current;
    setLoading(true);
    setError(null);
    listWines(filtersToApiParams(appliedFilters, PAGE_SIZE, 0))
      .then((data) => {
        if (requestId !== primaryRequestId.current) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (requestId !== primaryRequestId.current) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load wines. Please try again.");
      })
      .finally(() => {
        if (requestId !== primaryRequestId.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  useEffect(() => {
    if (loading) return;
    writePageState<ExploreSnapshot>(STATE_KEY, {
      filtersKey: filtersKeyOf(appliedFilters),
      items,
      total,
    });
  }, [items, total, loading, appliedFilters]);

  useEffect(() => {
    if (!restoredScrollRef.current && initial.hit) {
      restoredScrollRef.current = true;
      try {
        window.scrollTo(0, initial.scrollY);
      } catch {
        /* jsdom and some embedded webviews don't implement scrollTo. */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Kept separate from the items/total snapshot above so a scroll doesn't have to
    // re-serialize the (potentially large, "Load more"-grown) items array every frame.
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        writePageState<number>(SCROLL_KEY, window.scrollY);
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleLoadMore() {
    const requestId = ++loadMoreRequestId.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const next = await listWines(filtersToApiParams(appliedFilters, PAGE_SIZE, items.length));
      if (requestId !== loadMoreRequestId.current) return;
      setItems((prev) => [...prev, ...next.items]);
    } catch (err) {
      if (requestId !== loadMoreRequestId.current) return;
      setLoadMoreError(err instanceof ApiError ? err.message : "Failed to load more wines");
    } finally {
      if (requestId !== loadMoreRequestId.current) return;
      setLoadingMore(false);
    }
  }

  function invalidateLoadMore() {
    loadMoreRequestId.current += 1;
    setLoadingMore(false);
    setLoadMoreError(null);
  }

  function handleApplyFilters(filters: FilterValues) {
    invalidateLoadMore();
    setAppliedFilters(filters);
    setDrawerOpen(false);
  }

  function handleClearFilters() {
    invalidateLoadMore();
    setSearchDraft(DEFAULT_FILTERS.q);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = searchDraft.trim();
    if (trimmed === appliedFilters.q) return;
    invalidateLoadMore();
    setAppliedFilters((prev) => ({ ...prev, q: trimmed }));
  }

  function handleSortChange(sort: SortOption) {
    invalidateLoadMore();
    setAppliedFilters((prev) => ({ ...prev, sort }));
  }

  function removeFilter(key: keyof FilterValues) {
    invalidateLoadMore();
    if (key === "q") setSearchDraft(DEFAULT_FILTERS.q);
    setAppliedFilters((prev) => ({ ...prev, [key]: DEFAULT_FILTERS[key] }));
  }

  const activeCount = countActiveFilters(appliedFilters);
  const activeChips = CHIP_LABELS.filter((chip) => appliedFilters[chip.key]);
  const hasMore = items.length < total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Explore</h1>
        <FilterButton activeCount={activeCount} onClick={() => setDrawerOpen(true)} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form onSubmit={handleSearchSubmit} className="flex min-w-[160px] flex-1 flex-col gap-1">
          <label htmlFor="explore-search" className="text-sm text-ink-muted">
            Search
          </label>
          <input
            id="explore-search"
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Wine or winery name"
            className="w-full min-w-0 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </form>
        <div className="flex flex-col gap-1">
          <label htmlFor="explore-sort" className="text-sm text-ink-muted">
            Sort by
          </label>
          <select
            id="explore-sort"
            value={appliedFilters.sort}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-surface-border pl-3 pr-1 py-1 text-xs text-ink-muted"
            >
              {chip.describe(appliedFilters[chip.key])}
              <button
                type="button"
                onClick={() => removeFilter(chip.key)}
                aria-label={`Remove ${chip.name} filter`}
                className="rounded-full px-1 hover:text-ink"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <WineGrid wines={[]} skeletonCount={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage
          message="Couldn't load wines. Please try again."
          onRetry={() => setAppliedFilters({ ...appliedFilters })}
        />
      ) : items.length === 0 ? (
        <EmptyState onClear={handleClearFilters} />
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            Showing {items.length} of {total}
          </p>
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </>
      )}

      <FilterDrawer
        open={drawerOpen}
        initialFilters={appliedFilters}
        onApply={handleApplyFilters}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
