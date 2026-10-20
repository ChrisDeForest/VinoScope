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

const PAGE_SIZE = 20;
const STATE_KEY = "vinoscope-pair-state";
const LAST_STEP = 2;

interface PairSnapshot {
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
  return {
    mode: stored.mode === "results" && food ? "results" : "quiz",
    step: Math.min(Math.max(stored.step ?? 0, 0), LAST_STEP),
    food,
    types: stored.types ?? (stored.type ? [stored.type] : []),
    budget: stored.budget ?? pricesToBudget(undefined, stored.maxPrice),
    profile: stored.profile ?? [],
    items: stored.items ?? [],
    total: stored.total ?? 0,
  };
}

export function PairPage() {
  const [initial] = useState(readSnapshot);

  const [mode, setMode] = useState<"quiz" | "results">(initial?.mode ?? "quiz");
  const [step, setStep] = useState(initial?.step ?? 0);
  const [food, setFood] = useState<FoodKey | null>(initial?.food ?? null);
  const [types, setTypes] = useState<string[]>(initial?.types ?? []);
  const [budget, setBudget] = useState<string[]>(initial?.budget ?? []);
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
    writePageState<PairSnapshot>(STATE_KEY, { mode, step, food, types, budget, profile, items, total });
  }, [mode, step, food, types, budget, profile, items, total, loading]);

  async function fetchRecommendations(chosenFood: FoodKey, offset: number, append: boolean) {
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
        ...FOOD_PAIRINGS[chosenFood].vector,
        ...(types.length ? { type: types } : {}),
        ...budgetToPrices(budget),
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
    if (food) fetchRecommendations(food, 0, false);
  }

  function handleLoadMore() {
    if (food) fetchRecommendations(food, items.length, true);
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
    else if (food) fetchRecommendations(food, 0, false);
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
        <h1 className="font-serif text-2xl text-ink">Pair</h1>
        {error ? <ErrorMessage message={error} onRetry={handleRetry} /> : null}
        {loading && food ? (
          <p className="text-sm text-ink-muted" aria-live="polite">
            Finding wines for {foodLabel}…
          </p>
        ) : null}
        <QuizStage
          steps={steps}
          current={step}
          onJump={setStep}
          onContinue={handleContinue}
          continueLabel={continueLabel}
          continueDisabled={(step === 0 && !food) || loading}
        />
      </div>
    );
  }

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
