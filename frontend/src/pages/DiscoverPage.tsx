import { useEffect, useRef, useState } from "react";
import { ApiError, getRecommendations } from "../services/api";
import type { RecommendationAnswers, RecommendationItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { DiscoverForm } from "../components/discover/DiscoverForm";
import { ProfileSummary } from "../components/discover/ProfileSummary";
import { getStoredProfile, setStoredProfile } from "../utils/discoverProfile";

const PAGE_SIZE = 20;

export function DiscoverPage() {
  const [answers, setAnswers] = useState<RecommendationAnswers>(() => getStoredProfile() ?? {});
  const [mode, setMode] = useState<"form" | "results">(() => (getStoredProfile() ? "results" : "form"));
  const [profile, setProfile] = useState<string[]>([]);
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState<boolean>(() => getStoredProfile() !== null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const stored = getStoredProfile();
    if (stored) {
      fetchRecommendations(stored, 0, false);
    }
    return () => {
      requestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRecommendations(currentAnswers: RecommendationAnswers, offset: number, append: boolean) {
    const requestId = ++requestIdRef.current;
    if (append) {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoading(true);
      setError(null);
      // A fresh submit/reload supersedes any in-flight "load more" from the previous results.
      setLoadingMore(false);
      setLoadMoreError(null);
    }
    try {
      const response = await getRecommendations({ ...currentAnswers, limit: PAGE_SIZE, offset });
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

  function handleSubmit(newAnswers: RecommendationAnswers) {
    setAnswers(newAnswers);
    setStoredProfile(newAnswers);
    fetchRecommendations(newAnswers, 0, false);
  }

  function handleLoadMore() {
    fetchRecommendations(answers, items.length, true);
  }

  const hasMore = items.length < total;

  if (mode === "form") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-2xl text-ink">Discover</h1>
        {error ? (
          <ErrorMessage message={error} onRetry={() => fetchRecommendations(answers, 0, false)} />
        ) : null}
        <DiscoverForm initialAnswers={answers} onSubmit={handleSubmit} submitting={loading} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Discover</h1>
        <button type="button" onClick={() => setMode("form")} className="text-sm text-accent hover:underline">
          Edit preferences
        </button>
      </div>
      {loading ? (
        <WineGrid wines={[]} skeletonCount={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => fetchRecommendations(answers, 0, false)} />
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-muted mb-2">No wines match your preferences.</p>
          <button type="button" onClick={() => setMode("form")} className="text-sm text-accent hover:underline">
            Back to questionnaire
          </button>
        </div>
      ) : (
        <>
          <ProfileSummary description={profile} />
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </>
      )}
    </div>
  );
}
