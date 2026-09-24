import { useEffect, useRef, useState } from "react";
import { ApiError, getRecommendations } from "../services/api";
import type { RecommendationItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { ProfileSummary } from "../components/discover/ProfileSummary";
import { FoodPicker } from "../components/pair/FoodPicker";
import { PriceField } from "../components/discover/PriceField";
import { TYPE_OPTIONS, TYPE_LABELS } from "../constants/wineOptions";
import { FOOD_PAIRINGS, type FoodKey } from "../constants/foodPairings";
import { readPageState, writePageState } from "../utils/pageState";

const PAGE_SIZE = 20;
const STATE_KEY = "vinoscope-pair-state";

interface PairSnapshot {
  mode: "picker" | "results";
  selectedFood: FoodKey | null;
  type?: string;
  maxPrice?: number;
  profile: string[];
  items: RecommendationItem[];
  total: number;
}

export function PairPage() {
  const [initial] = useState(() => {
    const snapshot = readPageState<PairSnapshot>(STATE_KEY);
    // A snapshot saved under a since-renamed/removed FoodKey (e.g. an older "pasta"
    // before it split into "tomato_pasta"/"cream_pasta") can't be trusted at all --
    // FOOD_PAIRINGS[selectedFood] would be undefined and crash the results view.
    if (snapshot?.selectedFood && !(snapshot.selectedFood in FOOD_PAIRINGS)) return null;
    return snapshot;
  });

  const [mode, setMode] = useState<"picker" | "results">(initial?.mode ?? "picker");
  const [selectedFood, setSelectedFood] = useState<FoodKey | null>(initial?.selectedFood ?? null);
  const [type, setType] = useState<string | undefined>(initial?.type);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(initial?.maxPrice);
  const [profile, setProfile] = useState<string[]>(initial?.profile ?? []);
  const [items, setItems] = useState<RecommendationItem[]>(initial?.items ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    writePageState<PairSnapshot>(STATE_KEY, { mode, selectedFood, type, maxPrice, profile, items, total });
  }, [mode, selectedFood, type, maxPrice, profile, items, total, loading]);

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
      const response = await getRecommendations({
        ...FOOD_PAIRINGS[food].vector,
        type,
        max_price: maxPrice,
        limit: PAGE_SIZE,
        offset,
      });
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

  function chooseFood() {
    requestIdRef.current += 1;
    setLoading(false);
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    setMode("picker");
  }

  const hasMore = items.length < total;

  if (mode === "picker") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-2xl text-ink">Pair</h1>
        {error ? <ErrorMessage message={error} onRetry={handleRetry} /> : null}
        {loading && selectedFood ? (
          <p className="text-sm text-ink-muted" aria-live="polite">
            Finding wines for {FOOD_PAIRINGS[selectedFood].label}…
          </p>
        ) : null}
        <div className="flex gap-2 max-w-xl">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <label htmlFor="pair-type" className="text-sm text-ink-muted">
              Wine type
            </label>
            <select
              id="pair-type"
              value={type ?? ""}
              onChange={(e) => setType(e.target.value || undefined)}
              className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
            >
              {TYPE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "" ? "No preference" : TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <PriceField id="pair-max-price" label="Max price" value={maxPrice} onChange={setMaxPrice} />
        </div>
        <FoodPicker onSelect={handleSelectFood} loading={loading} />
      </div>
    );
  }

  const foodLabel = selectedFood ? FOOD_PAIRINGS[selectedFood].label : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Pair</h1>
        <button type="button" onClick={chooseFood} className="text-sm text-accent hover:underline">
          Choose a different food
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-muted">No wines available to pair right now.</p>
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
