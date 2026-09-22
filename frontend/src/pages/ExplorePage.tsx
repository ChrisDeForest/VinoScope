import { useEffect, useState } from "react";
import { ApiError, listWines } from "../services/api";
import { useApiQuery } from "../hooks/useApiQuery";
import type { WineListItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { FilterButton } from "../components/explore/FilterButton";
import { FilterDrawer } from "../components/explore/FilterDrawer";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { EmptyState } from "../components/explore/EmptyState";
import { ErrorMessage } from "../components/common/ErrorMessage";
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  filtersToApiParams,
  type FilterValues,
} from "../components/explore/filterTypes";

const PAGE_SIZE = 12;

export function ExplorePage() {
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<WineListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const { data, loading, error } = useApiQuery(
    () => listWines(filtersToApiParams(appliedFilters, PAGE_SIZE, 0)),
    [appliedFilters]
  );

  useEffect(() => {
    if (data) {
      setItems(data.items);
      setTotal(data.total);
    }
  }, [data]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const next = await listWines(filtersToApiParams(appliedFilters, PAGE_SIZE, items.length));
      setItems((prev) => [...prev, ...next.items]);
    } catch (err) {
      setLoadMoreError(err instanceof ApiError ? err.message : "Failed to load more wines");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleApplyFilters(filters: FilterValues) {
    setAppliedFilters(filters);
    setDrawerOpen(false);
  }

  function handleClearFilters() {
    setAppliedFilters(DEFAULT_FILTERS);
  }

  const activeCount = countActiveFilters(appliedFilters);
  const hasMore = items.length < total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Explore</h1>
        <FilterButton activeCount={activeCount} onClick={() => setDrawerOpen(true)} />
      </div>

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
