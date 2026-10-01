import type { Dimension } from "../../utils/dimensionLabels";
import type { ContentSource } from "./types";

export type GrapeColor = "red" | "white";
/** A typical score, or a [low, high] range for grapes that span the scale. */
export type ProfileValue = number | readonly [number, number];

export interface GrapeContent {
  /** URL-safe slug; also the deep-link anchor (`#grape-<id>`). */
  id: string;
  name: string;
  color: GrapeColor;
  /** Value for Explore's `grape` filter (a case-insensitive contains match). */
  exploreGrape: string;
  tagline: string;
  /** "What it's like". */
  about: string;
  /** "Tastes like". */
  notes: readonly string[];
  profile: Record<Dimension, ProfileValue>;
  /** "Where it shines". */
  regions: readonly string[];
  source: ContentSource;
}

export const GRAPES_CHAPTER = {
  id: "grapes",
  label: "Key Grapes",
  title: "Seven grapes to know",
  lead: "These seven grapes make many of the world's best-known wines. Pick one to see what it tastes like, where it grows best, and how to find it in the catalog.",
  source: "general",
} as const satisfies { id: "grapes"; label: string; title: string; lead: string; source: ContentSource };

export const DEFAULT_GRAPE_ID = "cabernet-sauvignon";

export const GRAPES: readonly GrapeContent[] = [
  {
    id: "cabernet-sauvignon",
    name: "Cabernet Sauvignon",
    color: "red",
    exploreGrape: "Cabernet Sauvignon",
    tagline: "The structured, age-worthy king of reds.",
    about: "Small, thick-skinned berries give Cabernet deep color, firm tannin and the backbone to age for decades. It loves warm, sunny, well-drained vineyards and leads most blends on Bordeaux's Left Bank.",
    notes: ["blackcurrant", "black cherry", "cedar", "mint"],
    profile: { sweetness: 1, acidity: 3, tannin: 5, body: 5, fruitiness: 4 },
    regions: ["Bordeaux (Left Bank)", "Napa Valley", "Coonawarra", "Chile"],
    source: "general",
  },
  {
    id: "merlot",
    name: "Merlot",
    color: "red",
    exploreGrape: "Merlot",
    tagline: "Cabernet's softer, plusher partner.",
    about: "Merlot ripens earlier than Cabernet and gives rounder, fleshier wines with gentler tannin. On Bordeaux's Right Bank it leads the blend; elsewhere it's often bottled on its own as an easygoing, fruit-forward red.",
    notes: ["plum", "black cherry", "cocoa"],
    profile: { sweetness: 1, acidity: 3, tannin: 3, body: 4, fruitiness: 4 },
    regions: ["Bordeaux (Right Bank: Pomerol, Saint-Émilion)", "Washington", "Napa Valley"],
    source: "general",
  },
  {
    id: "pinot-noir",
    name: "Pinot Noir",
    color: "red",
    exploreGrape: "Pinot Noir",
    tagline: "Thin-skinned, fussy and silky.",
    about: "Pinot Noir's thin skins make paler, lighter-bodied reds with bright acidity and soft tannin. It needs a cool climate and careful farming, but at its best it's fragrant and layered, with fruit and earthy, savory notes together.",
    notes: ["red cherry", "raspberry", "mushroom", "earth"],
    profile: { sweetness: 1, acidity: 4, tannin: 2, body: 2, fruitiness: 3 },
    regions: ["Burgundy", "Willamette Valley", "Sonoma Coast", "Central Otago"],
    source: "general",
  },
  {
    id: "syrah",
    name: "Syrah / Shiraz",
    color: "red",
    exploreGrape: "Syrah",
    tagline: "Dark, peppery and bold. Called Shiraz in Australia.",
    about: "Syrah makes deeply colored, full-bodied wines. In France's Northern Rhône it's savory and peppery; in warm Australia, where it goes by Shiraz, it's riper, richer and jammier.",
    notes: ["blackberry", "black pepper", "smoked meat"],
    profile: { sweetness: 1, acidity: 3, tannin: 4, body: 5, fruitiness: 4 },
    regions: ["Northern Rhône", "Barossa Valley", "Washington"],
    source: "general",
  },
  {
    id: "chardonnay",
    name: "Chardonnay",
    color: "white",
    exploreGrape: "Chardonnay",
    tagline: "The shape-shifter of white wine.",
    about: "Chardonnay is fairly neutral on its own, so climate and winemaking shape it. Cool-climate, unoaked styles like Chablis are lean and citrusy; warm-climate, oak-aged styles are rich and creamy, with notes of butter and vanilla.",
    notes: ["apple", "lemon", "pineapple", "butter", "vanilla"],
    profile: { sweetness: 1, acidity: 3, tannin: 1, body: [2, 4], fruitiness: 3 },
    regions: ["Burgundy (Chablis, Meursault)", "California", "Australia"],
    source: "general",
  },
  {
    id: "sauvignon-blanc",
    name: "Sauvignon Blanc",
    color: "white",
    exploreGrape: "Sauvignon Blanc",
    tagline: "Zesty, aromatic and green.",
    about: "Sauvignon Blanc is all about bright acidity and pungent aromas, from citrus and passion fruit to fresh-cut grass. It's usually made in stainless steel and drunk young, to keep that freshness.",
    notes: ["grapefruit", "green apple", "cut grass", "passion fruit"],
    profile: { sweetness: 1, acidity: 5, tannin: 1, body: 2, fruitiness: 4 },
    regions: ["Loire (Sancerre)", "Marlborough", "Bordeaux"],
    source: "general",
  },
  {
    id: "riesling",
    name: "Riesling",
    color: "white",
    exploreGrape: "Riesling",
    tagline: "Electric acidity, from bone dry to lusciously sweet.",
    about: "Riesling's high acidity keeps it refreshing at every sweetness level, from bone-dry Alsace and Australian styles to sweet German late-harvest wines. It's rarely oaked, and the best bottles age for decades, picking up honeyed, petrol-like notes.",
    notes: ["lime", "green apple", "peach", "honey", "petrol (with age)"],
    profile: { sweetness: [1, 5], acidity: 5, tannin: 1, body: 2, fruitiness: 4 },
    regions: ["Mosel", "Alsace", "Clare Valley", "Finger Lakes"],
    source: "general",
  },
];
