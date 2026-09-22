export const DIMENSION_LABELS: Record<string, Record<number, string>> = {
  sweetness: { 1: "Very dry", 2: "Dry", 3: "Off-dry", 4: "Sweet", 5: "Very sweet" },
  acidity: {
    1: "Low acidity",
    2: "Medium-low acidity",
    3: "Medium acidity",
    4: "Medium-high acidity",
    5: "High acidity",
  },
  tannin: {
    1: "Low tannin",
    2: "Medium-low tannin",
    3: "Medium tannin",
    4: "Medium-high tannin",
    5: "High tannin",
  },
  body: {
    1: "Very light-bodied",
    2: "Light-bodied",
    3: "Medium-bodied",
    4: "Full-bodied",
    5: "Very full-bodied",
  },
  fruitiness: {
    1: "Subtle fruit",
    2: "Light fruit",
    3: "Moderate fruit",
    4: "Fruit-forward",
    5: "Very fruit-forward",
  },
};

export const DIMENSION_TITLES: Record<string, string> = {
  sweetness: "Sweetness",
  acidity: "Acidity",
  tannin: "Tannin",
  body: "Body",
  fruitiness: "Fruit Intensity",
};

export const DIMENSIONS = ["sweetness", "acidity", "tannin", "body", "fruitiness"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
