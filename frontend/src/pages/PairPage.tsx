import { useRef, useState } from "react";
import { ApiError, getRecommendations } from "../services/api";
import type { RecommendationItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { ProfileSummary } from "../components/discover/ProfileSummary";
import { FoodPicker } from "../components/pair/FoodPicker";
import { FOOD_PAIRINGS, type FoodKey } from "../constants/foodPairings";

const PAGE_SIZE = 20;

export function PairPage() {
  const [mode, setMode] = useState<"picker" | "results">("picker");
  const [selectedFood, setSelectedFood] = useState<FoodKey | null>(null);
  const [profile, setProfile] = useState<string[]>([]);
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function fetchRecommendations(food: FoodKey, offset: number, append: boolean) {
    const requestId = ++requestIdRef.current;
    if (append) {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoading(true);
      setError(null);
      // A fresh food selection supersedes any in-flight "load more" from the previous results.
      setLoadingMore(false);
      setLoadMoreError(null);
    }
    try {
      const response = await getRecommendations({ ...FOOD_PAIRINGS[food].vector, limit: PAGE_SIZE, offset });
      if (requestId !== requestIdRef.current) return;
      setProfile(response.profile.description);
      setTotal(response.total);
      setItems((prev) => (append ? [...prev, ...response.items] : response.items));
      setMode("results");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof ApiError ? err.message : "Failed to load recommendations";
      if (append) {
        setLoadMoreError(message);
      } else {
        setError(message);
      }
    } finally {
      if (requestId !== requestIdRef.current) return;
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  function handleSelectFood(food: FoodKey) {
    setSelectedFood(food);
    fetchRecommendations(food, 0, false);
  }

  function handleRetry() {
    if (selectedFood) fetchRecommendations(selectedFood, 0, false);
  }

  function handleLoadMore() {
    if (selectedFood) fetchRecommendations(selectedFood, items.length, true);
  }

  const hasMore = items.length < total;

  if (mode === "picker") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-2xl text-ink">Pair</h1>
        {error ? <ErrorMessage message={error} onRetry={handleRetry} /> : null}
        <FoodPicker onSelect={handleSelectFood} loading={loading} />
      </div>
    );
  }

  const foodLabel = selectedFood ? FOOD_PAIRINGS[selectedFood].label : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Pair</h1>
        <button type="button" onClick={() => setMode("picker")} className="text-sm text-accent hover:underline">
          Choose a different food
        </button>
      </div>
      {loading ? (
        <WineGrid wines={[]} skeletonCount={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage message={error} onRetry={handleRetry} />
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-muted mb-2">No wines match this pairing.</p>
        </div>
      ) : (
        <>
          <ProfileSummary description={profile} title={`Pairing with ${foodLabel}`} />
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </>
      )}
    </div>
  );
}
