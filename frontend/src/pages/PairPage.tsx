import { useEffect, useRef, useState } from "react";
import { ApiError, getRecommendations } from "../services/api";
import type { RecommendationItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { ProfileSummary } from "../components/discover/ProfileSummary";
import { FoodCardGrid } from "../components/pair/FoodCardGrid";
import { QuizStage, type QuizStep } from "../components/quiz/QuizStage";
import { ChoicePills } from "../components/quiz/ChoicePills";
import {
  BUDGET_RANGES,
  TYPE_CHOICES,
  budgetSummary,
  budgetToPrices,
  labelsFor,
  listSummary,
  pricesToBudget,
  toggleBudget,
  toggleValue,
} from "../components/quiz/quizChoices";
import { FOOD_PAIRINGS, type FoodKey } from "../constants/foodPairings";
import { readPageState, writePageState } from "../utils/pageState";
import { usePageMeta } from "../hooks/usePageMeta";
import { eventList, priceParams, trackEvent, type EventParams } from "../utils/analytics";

const PAGE_SIZE = 20;
const STATE_KEY = "vinoscope-pair-state";
const LAST_STEP = 2;

/** The search that produced the results; Load more and Retry always repeat this, never the live quiz. */
interface PairRequest {
  food: FoodKey;
  types: string[];
  prices: { min_price?: number; max_price?: number };
}

interface PairSnapshot {
  request: PairRequest | null;
  mode: "quiz" | "results";
  step: number;
  food: FoodKey | null;
  types: string[];
  budget: string[];
  profile: string[];
  items: RecommendationItem[];
  total: number;
}

/** What may be in storage: the current shape or one saved by the old picker. */
type StoredPairState = Partial<Omit<PairSnapshot, "mode">> & {
  mode?: string;
  request?: PairRequest | null;
  selectedFood?: FoodKey | null;
  type?: string;
  maxPrice?: number;
};

function readSnapshot(): PairSnapshot | null {
  const stored = readPageState<StoredPairState>(STATE_KEY);
  if (!stored) return null;
  const food = stored.food ?? stored.selectedFood ?? null;
  // A snapshot saved under a since-renamed/removed FoodKey (e.g. an older "pasta"
  // before it split into "tomato_pasta"/"cream_pasta") can't be trusted at all --
  // FOOD_PAIRINGS[food] would be undefined and crash the results view.
  if (food && !(food in FOOD_PAIRINGS)) return null;
  const types = stored.types ?? (stored.type ? [stored.type] : []);
  const mode = stored.mode === "results" && food ? "results" : "quiz";
  let request: PairRequest | null = stored.request ?? null;
  if (request && !(request.food in FOOD_PAIRINGS)) request = null;
  if (!request && mode === "results" && food) {
    // Saved by the old picker: results were fetched with its free-form price, so keep it as sent.
    request = {
      food,
      types,
      prices: stored.budget ? budgetToPrices(stored.budget) : stored.maxPrice !== undefined ? { max_price: stored.maxPrice } : {},
    };
  }
  return {
    request,
    mode,
    step: Math.min(Math.max(stored.step ?? 0, 0), LAST_STEP),
    food,
    types,
    budget: stored.budget ?? pricesToBudget(undefined, stored.maxPrice),
    profile: stored.profile ?? [],
    items: stored.items ?? [],
    total: stored.total ?? 0,
  };
}

export function PairPage() {
  usePageMeta({ title: "Pair · VinoScope" });
  const [initial] = useState(readSnapshot);

  const [mode, setMode] = useState<"quiz" | "results">(initial?.mode ?? "quiz");
  const [step, setStep] = useState(initial?.step ?? 0);
  const [food, setFood] = useState<FoodKey | null>(initial?.food ?? null);
  const [types, setTypes] = useState<string[]>(initial?.types ?? []);
  const [budget, setBudget] = useState<string[]>(initial?.budget ?? []);
  const [request, setRequest] = useState<PairRequest | null>(initial?.request ?? null);
  const [profile, setProfile] = useState<string[]>(initial?.profile ?? []);
  const [items, setItems] = useState<RecommendationItem[]>(initial?.items ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  // A pairing search is reported once its results arrive, so the event can say how many matched.
  const pendingReportRef = useRef<EventParams | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownModeRef = useRef(mode);

  // Moving between the quiz and the results unmounts the control that was used, so
  // land focus on the page heading instead of dropping it to the body.
  useEffect(() => {
    if (shownModeRef.current === mode) return;
    shownModeRef.current = mode;
    headingRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    writePageState<PairSnapshot>(STATE_KEY, { request, mode, step, food, types, budget, profile, items, total });
  }, [request, mode, step, food, types, budget, profile, items, total, loading]);

  async function fetchRecommendations(sent: PairRequest, offset: number, append: boolean) {
    const requestId = ++requestIdRef.current;
    if (append) {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoading(true);
      setError(null);
      // A fresh search supersedes any in-flight "load more" from the previous results.
      setLoadingMore(false);
      setLoadMoreError(null);
    }
    try {
      const response = await getRecommendations({
        ...FOOD_PAIRINGS[sent.food].vector,
        ...(sent.types.length ? { type: sent.types } : {}),
        ...sent.prices,
        limit: PAGE_SIZE,
        offset,
      });
      if (requestId !== requestIdRef.current) return;
      setProfile(response.profile.description);
      setTotal(response.total);
      setItems((prev) => (append ? [...prev, ...response.items] : response.items));
      setMode("results");
      if (pendingReportRef.current && !append) {
        trackEvent("pairing_search", { ...pendingReportRef.current, results: response.total });
        pendingReportRef.current = null;
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof ApiError ? err.message : "Failed to load recommendations";
      if (append) {
        setLoadMoreError(message);
      } else {
        setError(message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }

  function handleRetry() {
    if (request) fetchRecommendations(request, 0, false);
  }

  function handleLoadMore() {
    if (request) fetchRecommendations(request, items.length, true);
  }

  function chooseFood() {
    requestIdRef.current += 1;
    setLoading(false);
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    setStep(0);
    setMode("quiz");
  }

  function handleContinue() {
    if (step < LAST_STEP) setStep(step + 1);
    else if (food) {
      const sent: PairRequest = { food, types, prices: budgetToPrices(budget) };
      setRequest(sent);
      pendingReportRef.current = { food: FOOD_PAIRINGS[food].label, wine_types: eventList(types), ...priceParams(sent.prices) };
      fetchRecommendations(sent, 0, false);
    }
  }

  const foodLabel = food ? FOOD_PAIRINGS[food].label : "";

  const steps: QuizStep[] = [
    {
      id: "food",
      question: "What are you eating?",
      hint: "Choose one dish and we'll find wines that suit it.",
      summary: foodLabel,
      content: <FoodCardGrid selected={food} onSelect={setFood} disabled={loading} />,
    },
    {
      id: "type",
      question: "What kind of wine?",
      hint: "Pick any styles you'd enjoy.",
      summary: listSummary(labelsFor(TYPE_CHOICES, types), "No preference"),
      content: (
        <ChoicePills
          legend="What kind of wine?"
          options={TYPE_CHOICES}
          selected={types}
          noneLabel="No preference"
          onToggle={(value) => setTypes(toggleValue(types, value))}
          onClear={() => setTypes([])}
          disabled={loading}
          describedBy="quiz-hint-type"
        />
      ),
    },
    {
      id: "budget",
      question: "What would you like to spend?",
      hint: "Pick one range or several next to each other.",
      summary: budgetSummary(budget),
      content: (
        <ChoicePills
          legend="What would you like to spend?"
          options={BUDGET_RANGES}
          selected={budget}
          noneLabel="Any price"
          onToggle={(value) => setBudget(toggleBudget(budget, value))}
          onClear={() => setBudget([])}
          disabled={loading}
          describedBy="quiz-hint-budget"
        />
      ),
    },
  ];

  const continueLabel =
    step === 0
      ? food
        ? `Continue with ${foodLabel.toLowerCase()}`
        : "Continue"
      : step === LAST_STEP
        ? loading
          ? "Finding wines…"
          : "Find my wines"
        : "Continue";

  const hasMore = items.length < total;

  if (mode === "quiz") {
    return (
      <div className="flex flex-col gap-6">
        <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl text-ink focus:outline-none">Pair</h1>
        {error ? <ErrorMessage message={error} onRetry={handleRetry} /> : null}
        <p className="min-h-[1.25rem] text-sm text-ink-muted" aria-live="polite">
          {loading && food ? `Finding wines for ${foodLabel}…` : ""}
        </p>
        <QuizStage
          steps={steps}
          current={step}
          onJump={setStep}
          onContinue={handleContinue}
          continueLabel={continueLabel}
          continueDisabled={(step === 0 && !food) || loading}
          disabled={loading}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl text-ink focus:outline-none">Pair</h1>
        <button type="button" onClick={chooseFood} className="text-sm text-accent hover:underline">
          Choose a different food
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-muted mb-2">No wines match these choices.</p>
          <button type="button" onClick={chooseFood} className="text-sm text-accent hover:underline">
            Choose a different food
          </button>
        </div>
      ) : (
        <>
          <ProfileSummary description={profile} title={`Pairing with ${request ? FOOD_PAIRINGS[request.food].label : foodLabel}`} />
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </>
      )}
    </div>
  );
}
