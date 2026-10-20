import type { RecommendationAnswers } from "../types/wine";
import { budgetToPrices, pricesToBudget } from "../components/quiz/quizChoices";
import { DIMENSIONS, type Dimension } from "./dimensionLabels";

/** Every Discover question as a list; an empty list means "no preference". */
export type DiscoverDraft = { type: string[]; country: string[]; budget: string[] } & Record<Dimension, number[]>;

export const EMPTY_DRAFT: DiscoverDraft = {
  type: [],
  country: [],
  budget: [],
  sweetness: [],
  acidity: [],
  tannin: [],
  body: [],
  fruitiness: [],
};

function asList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function draftToAnswers(draft: DiscoverDraft): RecommendationAnswers {
  const answers: RecommendationAnswers = {};
  if (draft.type.length) answers.type = draft.type;
  if (draft.country.length) answers.country = draft.country;
  for (const dim of DIMENSIONS) {
    const levels = draft[dim];
    if (levels.length) answers[dim] = levels.length === 1 ? levels[0] : levels;
  }
  return { ...answers, ...budgetToPrices(draft.budget) };
}

/** Also accepts profiles saved by the old form (single strings, free-form prices). */
export function answersToDraft(answers: RecommendationAnswers): DiscoverDraft {
  const draft: DiscoverDraft = {
    ...EMPTY_DRAFT,
    type: asList(answers.type),
    country: asList(answers.country),
    budget: pricesToBudget(answers.min_price, answers.max_price),
  };
  for (const dim of DIMENSIONS) draft[dim] = asList(answers[dim]);
  return draft;
}
