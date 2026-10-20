import { describe, it, expect } from "vitest";
import {
  BUDGET_RANGES,
  COUNTRY_CHOICES,
  TYPE_CHOICES,
  budgetSummary,
  budgetToPrices,
  labelsFor,
  listSummary,
  pricesToBudget,
  toggleBudget,
  toggleValue,
} from "./quizChoices";

describe("toggleValue", () => {
  it("adds a missing value and removes a present one", () => {
    expect(toggleValue([], "red")).toEqual(["red"]);
    expect(toggleValue(["red", "white"], "red")).toEqual(["white"]);
  });
});

describe("toggleBudget", () => {
  it("starts a run with the first pick", () => {
    expect(toggleBudget([], "40-80")).toEqual(["40-80"]);
  });
  it("extends the run and fills any gap", () => {
    expect(toggleBudget(["20-40"], "80-150")).toEqual(["20-40", "40-80", "80-150"]);
    expect(toggleBudget(["80-150"], "under-20")).toEqual(["under-20", "20-40", "40-80", "80-150"]);
  });
  it("removes a range at either end of the run", () => {
    expect(toggleBudget(["20-40", "40-80", "80-150"], "20-40")).toEqual(["40-80", "80-150"]);
    expect(toggleBudget(["20-40", "40-80", "80-150"], "80-150")).toEqual(["20-40", "40-80"]);
    expect(toggleBudget(["40-80"], "40-80")).toEqual([]);
  });
  it("shrinks to just an inner range when it is clicked", () => {
    expect(toggleBudget(["20-40", "40-80", "80-150"], "40-80")).toEqual(["40-80"]);
  });
});

describe("budgetToPrices", () => {
  it("maps the run to open-ended prices", () => {
    expect(budgetToPrices([])).toEqual({});
    expect(budgetToPrices(["under-20", "20-40"])).toEqual({ max_price: 40 });
    expect(budgetToPrices(["80-150", "150-plus"])).toEqual({ min_price: 80 });
    expect(budgetToPrices(["20-40", "40-80"])).toEqual({ min_price: 20, max_price: 80 });
    expect(budgetToPrices(BUDGET_RANGES.map((range) => range.value))).toEqual({});
  });
});

describe("pricesToBudget", () => {
  it("selects every range that overlaps legacy prices", () => {
    expect(pricesToBudget(undefined, undefined)).toEqual([]);
    expect(pricesToBudget(undefined, 30)).toEqual(["under-20", "20-40"]);
    expect(pricesToBudget(25, 60)).toEqual(["20-40", "40-80"]);
    expect(pricesToBudget(20, 40)).toEqual(["20-40"]);
    expect(pricesToBudget(200, undefined)).toEqual(["150-plus"]);
    expect(pricesToBudget(20, 20)).toEqual(["20-40"]);
  });
});

describe("summaries", () => {
  it("describes budgets", () => {
    expect(budgetSummary([])).toBe("Any price");
    expect(budgetSummary(["under-20", "20-40"])).toBe("Up to $40");
    expect(budgetSummary(["80-150", "150-plus"])).toBe("$80+");
    expect(budgetSummary(["20-40", "40-80"])).toBe("$20–$80");
    expect(budgetSummary(BUDGET_RANGES.map((range) => range.value))).toBe("Any price");
  });
  it("describes lists", () => {
    expect(listSummary([], "Anywhere")).toBe("Anywhere");
    expect(listSummary(["Red", "White"], "x")).toBe("Red, White");
    expect(listSummary(["Red", "White", "Rosé", "Dessert"], "x")).toBe("Red, White +2");
  });
  it("labels values in option order", () => {
    expect(labelsFor(TYPE_CHOICES, ["white", "red"])).toEqual(["Red", "White"]);
  });
});

describe("choice lists", () => {
  it("offers every wine type with a swatch and every country", () => {
    expect(TYPE_CHOICES.map((choice) => choice.value)).toEqual(["red", "white", "rosé", "sparkling", "dessert", "fortified"]);
    expect(TYPE_CHOICES.every((choice) => choice.swatch)).toBe(true);
    expect(COUNTRY_CHOICES).toHaveLength(13);
    expect(COUNTRY_CHOICES[0]).toEqual({ value: "Argentina", label: "Argentina" });
  });
});
