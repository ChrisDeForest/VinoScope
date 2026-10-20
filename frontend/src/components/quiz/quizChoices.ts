import { COUNTRY_OPTIONS, TYPE_OPTIONS, typeLabel } from "../../constants/wineOptions";

export interface ChoiceOption {
  value: string;
  label: string;
  swatch?: string;
}

export interface BudgetRange extends ChoiceOption {
  min: number | null;
  max: number | null;
}

export const BUDGET_RANGES: BudgetRange[] = [
  { value: "under-20", label: "Under $20", min: null, max: 20 },
  { value: "20-40", label: "$20–40", min: 20, max: 40 },
  { value: "40-80", label: "$40–80", min: 40, max: 80 },
  { value: "80-150", label: "$80–150", min: 80, max: 150 },
  { value: "150-plus", label: "$150+", min: 150, max: null },
];

const TYPE_SWATCHES: Record<string, string> = {
  red: "var(--color-wine-red)",
  white: "var(--color-wine-white)",
  rosé: "var(--color-wine-rose)",
  sparkling: "#efe2b4",
  dessert: "#b8862f",
  fortified: "#5a1420",
};

export const TYPE_CHOICES: ChoiceOption[] = TYPE_OPTIONS.filter(Boolean).map((value) => ({
  value,
  label: typeLabel(value),
  swatch: TYPE_SWATCHES[value],
}));

export const COUNTRY_CHOICES: ChoiceOption[] = COUNTRY_OPTIONS.filter(Boolean).map((name) => ({ value: name, label: name }));

export function toggleValue(selected: string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
}

function budgetIndexes(selected: string[]): number[] {
  return BUDGET_RANGES.flatMap((range, index) => (selected.includes(range.value) ? [index] : []));
}

function budgetRun(low: number, high: number): string[] {
  return BUDGET_RANGES.slice(low, high + 1).map((range) => range.value);
}

/** Budget picks always form one contiguous run of ranges. */
export function toggleBudget(selected: string[], value: string): string[] {
  const index = BUDGET_RANGES.findIndex((range) => range.value === value);
  if (index < 0) return selected;
  const picked = budgetIndexes(selected);
  if (picked.length === 0) return [value];
  const low = picked[0];
  const high = picked[picked.length - 1];
  if (!selected.includes(value)) return budgetRun(Math.min(low, index), Math.max(high, index));
  if (index === low) return budgetRun(low + 1, high);
  if (index === high) return budgetRun(low, high - 1);
  return [value];
}

export function budgetToPrices(selected: string[]): { min_price?: number; max_price?: number } {
  const picked = budgetIndexes(selected);
  if (picked.length === 0) return {};
  const min = BUDGET_RANGES[picked[0]].min;
  const max = BUDGET_RANGES[picked[picked.length - 1]].max;
  return { ...(min !== null ? { min_price: min } : {}), ...(max !== null ? { max_price: max } : {}) };
}

/** Maps free-form prices saved by the old form onto the ranges they overlap. */
export function pricesToBudget(min?: number, max?: number): string[] {
  if (min === undefined && max === undefined) return [];
  const low = min ?? 0;
  const high = max ?? Infinity;
  return BUDGET_RANGES.filter((range) => {
    const rangeLow = range.min ?? 0;
    const rangeHigh = range.max ?? Infinity;
    return low === high ? rangeLow <= low && low < rangeHigh : rangeLow < high && rangeHigh > low;
  }).map((range) => range.value);
}

export function budgetSummary(selected: string[]): string {
  const picked = budgetIndexes(selected);
  if (picked.length === 0 || picked.length === BUDGET_RANGES.length) return "Any price";
  const { min_price, max_price } = budgetToPrices(selected);
  if (min_price === undefined) return `Up to $${max_price}`;
  if (max_price === undefined) return `$${min_price}+`;
  return `$${min_price}–$${max_price}`;
}

export function listSummary(labels: string[], noneLabel: string): string {
  if (labels.length === 0) return noneLabel;
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

export function labelsFor(options: ChoiceOption[], values: string[]): string[] {
  return options.filter((option) => values.includes(option.value)).map((option) => option.label);
}
