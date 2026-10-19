import type { Dimension } from "../../utils/dimensionLabels";
import type { ContentSource } from "./types";

export interface WinePick {
  winery: string;
  name: string;
  /** `null` for non-vintage wines. */
  vintage: number | null;
  /** One line on why this wine sits at this end of the scale. */
  reason: string;
}

export interface TasteDimensionContent {
  dimension: Dimension;
  what: string;
  feel: string;
  tip: string;
  low: WinePick;
  high: WinePick;
  source: ContentSource;
}

export const TASTE_CHAPTER = {
  id: "taste",
  label: "How to Taste",
  title: "Five things your mouth is measuring",
  lead: "Class tasting follows the six S's: see, smell, swirl, sip, swallow or spit, and savor. Here are the same five scales Discover and Compare use: learn what each one feels like on the sip, then try real wines from either end.",
  source: "course",
} as const satisfies { id: "taste"; label: string; title: string; lead: string; source: ContentSource };

export const TASTE_DIMENSIONS: readonly TasteDimensionContent[] = [
  {
    dimension: "sweetness",
    what: "How much grape sugar is left after fermentation. Yeast turns sugar into alcohol; stop it early, or start with very ripe or shriveled grapes, and some sweetness remains.",
    feel: "Sweetness registers first, on the tip of your tongue. A dry wine can still taste fruity: fruit is something you smell, sugar is something you taste.",
    tip: "Pinch your nose while you sip. The aroma drops away, and what's left on the tip of your tongue is the sugar.",
    low: {
      winery: "Maison Trimbach", // sweetness 1
      name: "Trimbach Riesling",
      vintage: 2022,
      reason: "Alsace Riesling fermented fully dry, with no sugar left behind.",
    },
    high: {
      winery: "Schloss Johannisberg", // sweetness 5
      name: "Schloss Johannisberg Blaulack Riesling Trockenbeerenauslese",
      vintage: 2023,
      reason: "The same grape, made from shriveled, botrytis-affected berries picked one by one.",
    },
    source: "course",
  },
  {
    dimension: "acidity",
    what: "The tartness that makes a wine taste fresh and lively. Grapes from cooler climates hold on to more acid; warm climates ripen it away.",
    feel: "Your mouth waters, especially along the sides of your tongue, and the wine feels crisp rather than flat.",
    tip: "Right after a sip, tip your head forward slightly. The more your mouth waters, the higher the acidity.",
    low: {
      winery: "Castello del Poggio", // acidity 2 (no wine in the dataset scores 1)
      name: "Castello del Poggio Moscato",
      vintage: null,
      reason: "A soft, gentle Moscato made to feel round rather than zesty.",
    },
    high: {
      winery: "Cloudy Bay", // acidity 5
      name: "Cloudy Bay Sauvignon Blanc",
      vintage: 2023,
      reason: "Marlborough's cool nights keep this Sauvignon Blanc bright and zippy.",
    },
    source: "course",
  },
  {
    dimension: "tannin",
    what: "Compounds from grape skins, seeds and stems (and oak barrels) that give red wine its grip. White wines spend little time on their skins, so they have almost none.",
    feel: "A drying, gripping feeling on your gums and the middle of your tongue, like over-steeped black tea.",
    tip: "After a sip, run your tongue across your front teeth. The rougher they feel, the more tannin.",
    low: {
      winery: "Louis Jadot", // tannin 2
      name: "Louis Jadot Bourgogne Pinot Noir",
      vintage: 2022,
      reason: "Pinot Noir's thin skins keep even this red silky.",
    },
    high: {
      winery: "Vietti", // tannin 5
      name: "Vietti Barolo Castiglione",
      vintage: 2020,
      reason: "Nebbiolo is one of the most tannic grapes there is, and Barolo is famous for its grip.",
    },
    source: "course",
  },
  {
    dimension: "body",
    what: "How heavy and full the wine feels in your mouth. Alcohol is the biggest driver, along with sugar and extract.",
    feel: "Think skim milk, whole milk and cream: a light-bodied wine slips across your tongue, a full-bodied one coats it.",
    tip: "Check the alcohol on the label. Under about 12.5% usually feels light; over about 14% usually feels full.",
    low: {
      winery: "Joseph Drouhin", // body 1
      name: "Joseph Drouhin Chablis",
      vintage: 2022,
      reason: "Cool-climate Chablis: lean, lightly built, and low in alcohol.",
    },
    high: {
      winery: "Mollydooker", // body 5
      name: "Mollydooker The Boxer Shiraz",
      vintage: 2022,
      reason: "Ripe Australian Shiraz with high alcohol and dense extract.",
    },
    source: "course",
  },
  {
    dimension: "fruitiness",
    what: "How strongly the wine smells and tastes of fruit (berries, citrus, stone fruit) rather than earthy, mineral or savory notes.",
    feel: "Mostly in your nose: fruit-forward wines leap out of the glass, while subtle ones need a swirl to open up.",
    tip: "Swirl, then take two short sniffs and name the first fruit you think of. If nothing comes to mind, the fruit is subtle.",
    low: {
      winery: "William Fèvre", // fruitiness 2 (no wine in the dataset scores 1)
      name: "William Fèvre Chablis Domaine",
      vintage: 2022,
      reason: "Chablis shows Chardonnay's quiet side: citrus, stone and chalk.",
    },
    high: {
      winery: "Far Niente", // fruitiness 5
      name: "Far Niente Chardonnay",
      vintage: 2023,
      reason: "The same grape in sunny Napa: ripe, generous orchard and tropical fruit.",
    },
    source: "course",
  },
];
