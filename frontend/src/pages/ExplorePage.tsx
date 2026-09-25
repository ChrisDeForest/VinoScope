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

type PageSize = number | "all";

const PAGE_SIZE_OPTIONS: PageSize[] = [12, 24, 48, 96, "all"];
const DEFAULT_PAGE_SIZE = 12;
// The wines API rejects a limit above 100, so bigger ranges are fetched in chunks.
const API_MAX_LIMIT = 100;
const STATE_KEY = "vinoscope-explore-state";
const SCROLL_KEY = "vinoscope-explore-scroll";
const PAGE_SIZE_KEY = "vinoscope-explore-page-size";

function readPageSize(): PageSize {
  try {
    const stored = localStorage.getItem(PAGE_SIZE_KEY);
    const match = PAGE_SIZE_OPTIONS.find((option) => String(option) === stored);
    return match ?? DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function writePageSize(size: PageSize): void {
  try {
    localStorage.setItem(PAGE_SIZE_KEY, String(size));
  } catch {
    /* Storage can be unavailable; the choice still applies for this visit. */
  }
}

/** Fetches up to `count` wines from `offset` (`Infinity` = to the end), one API-sized chunk at a time. */
async function fetchWineRange(
  filters: FilterValues,
  offset: number,
  count: number
): Promise<{ items: WineListItem[]; total: number }> {
  const items: WineListItem[] = [];
  let total = Infinity;
  while (items.length < count && offset + items.length < total) {
    const limit = Math.min(API_MAX_LIMIT, count - items.length);
    const page = await listWines(filtersToApiParams(filters, limit, offset + items.length));
    total = page.total;
    items.push(...page.items);
    // A short page means the API has nothing more for these filters.
    if (page.items.length < limit) break;
  }
  return { items, total: Number.isFinite(total) ? total : offset };
}

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
  const [pageSize, setPageSize] = useState<PageSize>(readPageSize);
  const loadMoreRequestId = useRef(0);
  const primaryRequestId = useRef(0);
  // The main fetch effect only depends on `appliedFilters`, so it can't pick up
  // a `pageSize` change made after it was scheduled; it reads this ref instead
  // of the `pageSize` closure so it always uses the latest choice.
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  // Which filters the wines in `items` were loaded for. A fetch is skipped when
  // it already matches, which (unlike a one-shot "skip once" flag) survives
  // StrictMode running the effect twice after a snapshot restore.
  const loadedFiltersKeyRef = useRef<string | null>(initial.hit ? initial.snapshot!.filtersKey : null);
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
    const filtersKey = filtersKeyOf(appliedFilters);
    const requestId = ++primaryRequestId.current;
    setError(null);
    if (loadedFiltersKeyRef.current === filtersKey) {
      // Already showing these filters' wines (a restored snapshot, or a switch
      // back while another fetch was in flight -- bumping the id drops that one).
      setLoading(false);
      return;
    }
    setLoading(true);
    const size = pageSizeRef.current;
    fetchWineRange(appliedFilters, 0, size === "all" ? Infinity : size)
      .then((data) => {
        if (requestId !== primaryRequestId.current) return;
        loadedFiltersKeyRef.current = filtersKey;
        setItems(data.items);
        setTotal(data.total);
        // Drop any loadMore that was still in flight for the previous items/total.
        loadMoreRequestId.current += 1;
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

  async function loadMore(count: number) {
    const requestId = ++loadMoreRequestId.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const next = await fetchWineRange(appliedFilters, items.length, count);
      if (requestId !== loadMoreRequestId.current) return;
      setItems((prev) => [...prev, ...next.items]);
      setTotal(next.total);
    } catch (err) {
      if (requestId !== loadMoreRequestId.current) return;
      setLoadMoreError(err instanceof ApiError ? err.message : "Failed to load more wines");
    } finally {
      if (requestId !== loadMoreRequestId.current) return;
      setLoadingMore(false);
    }
  }

  function handleLoadMore() {
    void loadMore(pageSize === "all" ? Infinity : pageSize);
  }

  function handlePageSizeChange(size: PageSize) {
    setPageSize(size);
    writePageSize(size);
    invalidateLoadMore();
    const target = size === "all" ? total : Math.min(size, total);
    if (items.length > target) {
      setItems((prev) => prev.slice(0, target));
    } else if (items.length < target) {
      void loadMore(target - items.length);
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
        <div className="flex flex-col gap-1">
          <label htmlFor="explore-page-size" className="text-sm text-ink-muted">
            Show
          </label>
          <select
            id="explore-page-size"
            value={String(pageSize)}
            onChange={(e) => handlePageSizeChange(e.target.value === "all" ? "all" : Number(e.target.value))}
            disabled={loading}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink disabled:opacity-60"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>
                {option === "all" ? (total > 0 ? `All (${total})` : "All") : option}
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
        <WineGrid wines={[]} skeletonCount={pageSize === "all" ? DEFAULT_PAGE_SIZE : pageSize} />
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
