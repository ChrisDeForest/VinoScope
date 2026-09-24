import type { RecommendationAnswers } from "../types/wine";

export type FoodKey =
  | "steak"
  | "burgers"
  | "chicken"
  | "salmon"
  | "shellfish"
  | "pasta"
  | "pizza"
  | "spicy"
  | "cheese"
  | "chocolate"
  | "dessert";

export type Dimension = "sweetness" | "acidity" | "tannin" | "body" | "fruitiness";

// This indexed-access mapped type ties FoodVector's keys directly to
// RecommendationAnswers's own fields: if a dimension is ever renamed there,
// this line fails to compile instead of silently sending the old key name
// to the backend (a plain standalone `interface FoodVector` would not catch that).
type FoodVector = { [K in Dimension]: Extract<NonNullable<RecommendationAnswers[K]>, number[]> };

interface FoodPairing {
  label: string;
  blurb: string;
  vector: FoodVector;
}

function range(min: number, max: number): number[] {
  const levels: number[] = [];
  for (let level = min; level <= max; level++) levels.push(level);
  return levels;
}

export const FOOD_OPTIONS: FoodKey[] = [
  "steak",
  "burgers",
  "chicken",
  "salmon",
  "shellfish",
  "pasta",
  "pizza",
  "spicy",
  "cheese",
  "chocolate",
  "dessert",
];

export const FOOD_PAIRINGS: Record<FoodKey, FoodPairing> = {
  steak: {
    label: "Steak",
    blurb: "Bold, high-tannin reds cut through the fat and match the richness.",
    vector: { sweetness: range(1, 1), acidity: range(3, 4), tannin: range(4, 5), body: range(4, 5), fruitiness: range(3, 4) },
  },
  burgers: {
    label: "Burgers",
    blurb: "Juicy, fruit-forward reds with moderate structure.",
    vector: { sweetness: range(1, 2), acidity: range(3, 4), tannin: range(3, 4), body: range(3, 4), fruitiness: range(3, 4) },
  },
  chicken: {
    label: "Chicken",
    blurb: "Versatile white meat — lighter reds or fuller whites both work.",
    vector: { sweetness: range(1, 2), acidity: range(3, 4), tannin: range(1, 3), body: range(2, 4), fruitiness: range(2, 4) },
  },
  salmon: {
    label: "Salmon",
    blurb: "High acidity cuts the fish's natural oiliness; low tannin avoids a metallic clash.",
    vector: { sweetness: range(1, 2), acidity: range(4, 5), tannin: range(1, 2), body: range(2, 3), fruitiness: range(2, 3) },
  },
  shellfish: {
    label: "Shellfish",
    blurb: "Crisp, delicate, high-acid whites that don't overpower.",
    vector: { sweetness: range(1, 1), acidity: range(4, 5), tannin: range(1, 1), body: range(1, 2), fruitiness: range(1, 2) },
  },
  pasta: {
    label: "Pasta",
    blurb: "High acidity stands up to tomato-based sauces.",
    vector: { sweetness: range(1, 2), acidity: range(4, 5), tannin: range(2, 4), body: range(2, 4), fruitiness: range(2, 4) },
  },
  pizza: {
    label: "Pizza",
    blurb: "Bright, medium-bodied reds like the Italian table-wine tradition.",
    vector: { sweetness: range(1, 2), acidity: range(4, 5), tannin: range(2, 3), body: range(2, 3), fruitiness: range(3, 4) },
  },
  spicy: {
    label: "Spicy foods",
    blurb: "A touch of sweetness cools the heat; low tannin avoids amplifying it.",
    vector: { sweetness: range(2, 3), acidity: range(3, 4), tannin: range(1, 2), body: range(1, 3), fruitiness: range(3, 5) },
  },
  cheese: {
    label: "Cheese",
    blurb: "Broad range reflecting how differently soft vs. aged cheeses pair.",
    vector: { sweetness: range(1, 3), acidity: range(2, 4), tannin: range(2, 4), body: range(3, 5), fruitiness: range(2, 4) },
  },
  chocolate: {
    label: "Chocolate",
    blurb: "The wine must be sweeter than the chocolate itself, full-bodied, fruit-forward.",
    vector: { sweetness: range(4, 5), acidity: range(1, 2), tannin: range(2, 4), body: range(4, 5), fruitiness: range(4, 5) },
  },
  dessert: {
    label: "Dessert",
    blurb: "Sweet, low-tannin, fruit-forward — the wine outsweetens the dish.",
    vector: { sweetness: range(4, 5), acidity: range(1, 3), tannin: range(1, 2), body: range(2, 4), fruitiness: range(3, 5) },
  },
};
