import { useEffect, useRef, useState } from "react";
import { ApiError, getRecommendations } from "../services/api";
import type { RecommendationAnswers, RecommendationItem } from "../types/wine";
import { WineGrid } from "../components/wine/WineGrid";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { ProfileSummary } from "../components/discover/ProfileSummary";
import { QuizStage, type QuizStep } from "../components/quiz/QuizStage";
import { ChoicePills } from "../components/quiz/ChoicePills";
import {
  BUDGET_RANGES,
  COUNTRY_CHOICES,
  TYPE_CHOICES,
  budgetSummary,
  labelsFor,
  listSummary,
  toggleBudget,
  toggleValue,
  type ChoiceOption,
} from "../components/quiz/quizChoices";
import { DIMENSION_LABELS, DIMENSIONS, type Dimension } from "../utils/dimensionLabels";
import { answersToDraft, draftToAnswers, EMPTY_DRAFT, type DiscoverDraft } from "../utils/discoverDraft";
import { clearStoredProfile, getStoredProfile, setStoredProfile } from "../utils/discoverProfile";
import { clearPageState, readPageState, writePageState } from "../utils/pageState";

const PAGE_SIZE = 20;
const STATE_KEY = "vinoscope-discover-state";

const TASTE_QUESTIONS: Record<Dimension, { question: string; hint: string }> = {
  sweetness: { question: "How sweet do you like it?", hint: "Dry wines have almost no sugar; sweet wines taste like dessert." },
  acidity: { question: "How much zing do you like?", hint: "Acidity is the mouth-watering freshness, like biting a green apple." },
  tannin: { question: "How much grip do you like?", hint: "Tannin is the drying grip you feel from red wine, like strong tea." },
  body: { question: "How heavy should it feel?", hint: "Body is how heavy the wine feels, like skim milk versus cream." },
  fruitiness: {
    question: "How fruity should it taste?",
    hint: "Fruitiness is how much the wine tastes of ripe fruit rather than earth or spice.",
  },
};

function levelChoices(dim: Dimension): ChoiceOption[] {
  return [1, 2, 3, 4, 5].map((level) => ({ value: String(level), label: DIMENSION_LABELS[dim][level] }));
}

interface DiscoverSnapshot {
  answersKey: string;
  mode: "quiz" | "results";
  step: number;
  draft: DiscoverDraft;
  profile: string[];
  items: RecommendationItem[];
  total: number;
}

export function DiscoverPage() {
  const [initial] = useState(() => {
    const stored = getStoredProfile();
    const answers = stored ?? {};
    const snapshot = readPageState<DiscoverSnapshot>(STATE_KEY);
    // Snapshots saved by the old form have no draft; they are rebuilt from the stored profile instead.
    const hit = snapshot !== null && snapshot.answersKey === JSON.stringify(answers) && snapshot.draft !== undefined;
    return { answers, hasStoredProfile: stored !== null, hit, snapshot };
  });

  const [answers, setAnswers] = useState<RecommendationAnswers>(initial.answers);
  const [draft, setDraft] = useState<DiscoverDraft>(initial.hit ? initial.snapshot!.draft : answersToDraft(initial.answers));
  const [step, setStep] = useState(initial.hit ? initial.snapshot!.step : 0);
  const [mode, setMode] = useState<"quiz" | "results">(
    initial.hit ? initial.snapshot!.mode : initial.hasStoredProfile ? "results" : "quiz"
  );
  const [profile, setProfile] = useState<string[]>(initial.hit ? initial.snapshot!.profile : []);
  const [items, setItems] = useState<RecommendationItem[]>(initial.hit ? initial.snapshot!.items : []);
  const [total, setTotal] = useState(initial.hit ? initial.snapshot!.total : 0);
  const [loading, setLoading] = useState<boolean>(!initial.hit && initial.hasStoredProfile);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const skipInitialFetchRef = useRef(initial.hit);
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
    if (!skipInitialFetchRef.current) {
      const stored = getStoredProfile();
      if (stored) {
        fetchRecommendations(stored, 0, false);
      }
    }
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    writePageState<DiscoverSnapshot>(STATE_KEY, {
      answersKey: JSON.stringify(answers),
      mode,
      step,
      draft,
      profile,
      items,
      total,
    });
  }, [answers, mode, step, draft, profile, items, total, loading]);

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
      if (requestId === requestIdRef.current) {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }

  function submit() {
    const newAnswers = draftToAnswers(draft);
    setAnswers(newAnswers);
    setStoredProfile(newAnswers);
    fetchRecommendations(newAnswers, 0, false);
  }

  function handleLoadMore() {
    fetchRecommendations(answers, items.length, true);
  }

  function cancelRequests() {
    requestIdRef.current += 1;
    setLoading(false);
    setLoadingMore(false);
    setLoadMoreError(null);
    setError(null);
  }

  function editAnswers() {
    cancelRequests();
    setStep(0);
    setMode("quiz");
  }

  function startOver() {
    cancelRequests();
    setAnswers({});
    setDraft(EMPTY_DRAFT);
    setStep(0);
    setItems([]);
    setTotal(0);
    setProfile([]);
    clearStoredProfile();
    clearPageState(STATE_KEY);
    setMode("quiz");
  }

  function setAnswer<K extends keyof DiscoverDraft>(key: K, value: DiscoverDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function listStep(id: "type" | "country", question: string, hint: string, options: ChoiceOption[], noneLabel: string): QuizStep {
    return {
      id,
      question,
      hint,
      summary: listSummary(labelsFor(options, draft[id]), noneLabel),
      content: (
        <ChoicePills
          legend={question}
          options={options}
          selected={draft[id]}
          noneLabel={noneLabel}
          onToggle={(value) => setAnswer(id, toggleValue(draft[id], value))}
          onClear={() => setAnswer(id, [])}
          disabled={loading}
          describedBy={`quiz-hint-${id}`}
        />
      ),
    };
  }

  function tasteStep(dim: Dimension): QuizStep {
    const options = levelChoices(dim);
    const selected = draft[dim].map(String);
    const { question, hint } = TASTE_QUESTIONS[dim];
    return {
      id: dim,
      question,
      hint,
      summary: listSummary(labelsFor(options, selected), "I'm not sure"),
      content: (
        <ChoicePills
          legend={question}
          options={options}
          selected={selected}
          noneLabel="I'm not sure"
          onToggle={(value) => setAnswer(dim, toggleValue(selected, value).map(Number).sort((a, b) => a - b))}
          onClear={() => setAnswer(dim, [])}
          disabled={loading}
          describedBy={`quiz-hint-${dim}`}
        />
      ),
    };
  }

  const steps: QuizStep[] = [
    listStep("type", "What are you in the mood for?", "Pick any styles you'd enjoy.", TYPE_CHOICES, "No preference"),
    listStep("country", "Any countries you love?", "Pick as many as you like.", COUNTRY_CHOICES, "Anywhere"),
    {
      id: "budget",
      question: "What would you like to spend?",
      hint: "Pick one range or several next to each other.",
      summary: budgetSummary(draft.budget),
      content: (
        <ChoicePills
          legend="What would you like to spend?"
          options={BUDGET_RANGES}
          selected={draft.budget}
          noneLabel="Any price"
          onToggle={(value) => setAnswer("budget", toggleBudget(draft.budget, value))}
          onClear={() => setAnswer("budget", [])}
          disabled={loading}
          describedBy="quiz-hint-budget"
        />
      ),
    },
    ...DIMENSIONS.map(tasteStep),
  ];

  const hasMore = items.length < total;
  const lastStep = step === steps.length - 1;
  const hasAnswers = step > 0 || JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);

  if (mode === "quiz") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl text-ink focus:outline-none">Discover</h1>
          {hasAnswers ? (
            <button type="button" onClick={startOver} className="text-sm text-accent hover:underline">
              Start over
            </button>
          ) : null}
        </div>
        {error ? <ErrorMessage message={error} onRetry={() => fetchRecommendations(answers, 0, false)} /> : null}
        <QuizStage
          steps={steps}
          current={step}
          onJump={setStep}
          onContinue={() => (lastStep ? submit() : setStep(step + 1))}
          continueLabel={lastStep ? (loading ? "Finding wines…" : "Show my wines") : "Continue"}
          continueDisabled={loading}
          disabled={loading}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl text-ink focus:outline-none">Discover</h1>
        <div className="flex gap-4">
          <button type="button" onClick={editAnswers} className="text-sm text-accent hover:underline">
            Edit answers
          </button>
          <button type="button" onClick={startOver} className="text-sm text-ink-muted hover:text-ink hover:underline">
            Start over
          </button>
        </div>
      </div>
      {loading ? (
        <WineGrid wines={[]} skeletonCount={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => fetchRecommendations(answers, 0, false)} />
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-muted mb-2">No wines match your preferences.</p>
          <button type="button" onClick={editAnswers} className="text-sm text-accent hover:underline">
            Back to questionnaire
          </button>
        </div>
      ) : (
        <>
          <ProfileSummary description={profile} />
          <p className="text-sm text-ink-muted">Match percentages describe closeness to your selected taste factors, not a rating of wine quality. Price, type and country narrow the results.</p>
          <WineGrid wines={items} />
          {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
          {hasMore ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
        </>
      )}
    </div>
  );
}
