import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigationType, useSearchParams } from "react-router-dom";
import { ApiError, listWines } from "../services/api";
import type { SortOption, WineListItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { FilterButton } from "../components/explore/FilterButton";
import { FilterDrawer } from "../components/explore/FilterDrawer";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { EmptyState } from "../components/explore/EmptyState";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { ComboBox } from "../components/common/ComboBox";
import { typeLabel } from "../constants/wineOptions";
import { DIMENSIONS, DIMENSION_TITLES } from "../utils/dimensionLabels";
import { describeTasteRange } from "../utils/tasteRange";
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
  { key: "type", name: "type", describe: (value) => `Type: ${typeLabel(value)}` },
  { key: "country", name: "country", describe: (value) => `Country: ${value}` },
  { key: "region", name: "region", describe: (value) => `Region: ${value}` },
  { key: "grape", name: "grape", describe: (value) => `Grape: ${value}` },
  { key: "minPrice", name: "min price", describe: (value) => `Min price: $${value}` },
  { key: "maxPrice", name: "max price", describe: (value) => `Max price: $${value}` },
  { key: "minAbv", name: "min alcohol", describe: (value) => `Min alcohol: ${value}%` },
  { key: "maxAbv", name: "max alcohol", describe: (value) => `Max alcohol: ${value}%` },
  { key: "vintageFrom", name: "vintage from", describe: (value) => `Vintage from: ${value}` },
  { key: "vintageTo", name: "vintage to", describe: (value) => `Vintage to: ${value}` },
  { key: "excludeNv", name: "non-vintage", describe: () => "No NV wines" },
  ...DIMENSIONS.map((dimension) => ({
    key: dimension,
    name: DIMENSION_TITLES[dimension].toLowerCase(),
    describe: (value: string) => `${DIMENSION_TITLES[dimension]}: ${describeTasteRange(dimension, value)}`,
  })),
];

type PageSize = number | "all";

const PAGE_SIZE_OPTIONS: PageSize[] = [12, 24, 48, 96, 200, "all"];
const DEFAULT_PAGE_SIZE = 12;
const CUSTOM_OPTION = "custom";
// The wines API rejects a limit above 100, so bigger ranges are fetched in chunks.
const API_MAX_LIMIT = 100;
const STATE_KEY = "vinoscope-explore-state";
const SCROLL_KEY = "vinoscope-explore-scroll";
const PAGE_SIZE_KEY = "vinoscope-explore-page-size";

function readPageSize(): PageSize {
  try {
    const stored = localStorage.getItem(PAGE_SIZE_KEY);
    if (stored === "all") return "all";
    // Any whole number counts, so a custom amount is remembered as well as the presets.
    const size = Number(stored);
    return stored !== null && Number.isInteger(size) && size > 0 ? size : DEFAULT_PAGE_SIZE;
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
  const navigationType = useNavigationType();

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
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
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
    if (!restoredScrollRef.current) {
      restoredScrollRef.current = true;
      // The app doesn't reset scroll between pages, so set it here: Back/Forward returns to
      // where the reader was; arriving by a link starts at the top of the results.
      const restore = navigationType === "POP" && initial.hit;
      try {
        window.scrollTo(0, restore ? initial.scrollY : 0);
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
      if (requestId === loadMoreRequestId.current) setLoadingMore(false);
    }
  }

  function handleLoadMore() {
    void loadMore(pageSize === "all" ? Infinity : pageSize);
  }

  function handleShowChange(value: string) {
    if (value === CUSTOM_OPTION) {
      setCustomDraft(typeof pageSize === "number" ? String(pageSize) : "");
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    handlePageSizeChange(value === "all" ? "all" : Number(value));
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    const size = Math.round(Number(customDraft));
    if (!Number.isFinite(size) || size < 1) return;
    setCustomOpen(false);
    // Anything past the total is capped rather than rejected, so a big number means "all of them".
    handlePageSizeChange(total > 0 ? Math.min(size, total) : size);
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
  const showOptions = [
    ...PAGE_SIZE_OPTIONS.map((option) => ({
      value: String(option),
      label: option === "all" ? (total > 0 ? `All (${total})` : "All") : String(option),
    })),
    ...(PAGE_SIZE_OPTIONS.includes(pageSize) ? [] : [{ value: String(pageSize), label: `${pageSize} (custom)` }]),
    { value: CUSTOM_OPTION, label: "Custom…" },
  ];

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
        <ComboBox
          id="explore-sort"
          label="Sort by"
          value={appliedFilters.sort}
          options={SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          onChange={(value) => handleSortChange(value as SortOption)}
          searchable={false}
          className="w-44"
        />
        <ComboBox
          id="explore-page-size"
          label="Show"
          value={String(pageSize)}
          options={showOptions}
          onChange={handleShowChange}
          searchable={false}
          disabled={loading}
          className="w-32"
        />
        {customOpen ? (
          <form onSubmit={handleCustomSubmit} className="flex items-end gap-1">
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              {total > 0 ? `How many (1–${total})` : "How many"}
              <input
                type="number"
                min={1}
                step={1}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                autoFocus
                className="w-24 bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
              />
            </label>
            <button type="submit" className="rounded border border-surface-border px-3 py-1 text-sm text-ink hover:border-accent">
              Apply
            </button>
          </form>
        ) : null}
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

      {loading && items.length === 0 ? (
        <WineGrid wines={[]} skeletonCount={pageSize === "all" ? DEFAULT_PAGE_SIZE : pageSize} />
      ) : error ? (
        <ErrorMessage
          message="Couldn't load wines. Please try again."
          onRetry={() => setAppliedFilters({ ...appliedFilters })}
        />
      ) : items.length === 0 ? (
        <EmptyState onClear={handleClearFilters} />
      ) : (
        // While new filters load, the current wines stay and gently dim instead of flashing to
        // skeletons; the short delay keeps quick responses from dimming at all.
        <div
          aria-busy={loading}
          data-testid="explore-results"
          className={`flex flex-col gap-6 transition-opacity duration-200 motion-reduce:transition-none ${loading ? "pointer-events-none opacity-50 delay-150" : "opacity-100"}`}
        >
          <p className="text-sm text-ink-muted">
            Showing {items.length} of {total}
          </p>
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </div>
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
