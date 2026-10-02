import type { ContentSource } from "./types";
import type { WineStyle } from "./vine";

export type GlossaryCategory = "tasting" | "winemaking" | "vineyard" | "label" | "serving";

export const GLOSSARY_CATEGORIES: readonly GlossaryCategory[] = ["tasting", "winemaking", "vineyard", "label", "serving"];

export const GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  tasting: "Tasting",
  winemaking: "Winemaking",
  vineyard: "Vineyard",
  label: "Label & Law",
  serving: "Serving",
};

/** Explore's `type` filter values: the vine chapter's styles plus dessert. */
export type ExploreType = WineStyle | "dessert";

export type SeeAlso =
  /** An element id on the Learn page; followed as a plain in-page anchor. */
  | { kind: "learn"; anchor: string; label: string }
  | { kind: "explore"; params: { type?: ExploreType; country?: string }; label: string };

export interface GlossaryTerm {
  /** URL-safe slug; also the deep-link anchor (`#term-<id>`). */
  id: string;
  term: string;
  category: GlossaryCategory;
  definition: string;
  seeAlso?: SeeAlso;
  /** 1–3 other term ids. */
  related?: readonly string[];
  source: ContentSource;
}

export const GLOSSARY_CHAPTER = {
  id: "glossary",
  label: "Glossary",
  title: "Words to know",
  lead: "The words you'll hear at tastings, on labels and in class, in plain language. Search for a term or pick a category, and follow the links to see each idea in action.",
  source: "general",
} as const satisfies { id: "glossary"; label: string; title: string; lead: string; source: ContentSource };

const TASTE = "See it in How to Taste";
const VINE = "See it in Vine to Glass";

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  // Tasting
  {
    id: "acidity",
    term: "Acidity",
    category: "tasting",
    definition: "The tart, mouth-watering quality that makes your cheeks pucker. It keeps a wine fresh and lively; too little and the wine tastes flat.",
    seeAlso: { kind: "learn", anchor: "taste-acidity-title", label: TASTE },
    related: ["balance", "minerality"],
    source: "general",
  },
  {
    id: "tannin",
    term: "Tannin",
    category: "tasting",
    definition: "Compounds from grape skins, seeds and oak that dry out your gums and grip your tongue, like strong black tea. Mostly found in reds, and they soften as a wine ages.",
    seeAlso: { kind: "learn", anchor: "taste-tannin-title", label: TASTE },
    related: ["maceration", "oak-aging"],
    source: "general",
  },
  {
    id: "body",
    term: "Body",
    category: "tasting",
    definition: "How heavy or full the wine feels in your mouth, from light like skim milk to full like whole milk. Alcohol is the biggest driver: more alcohol, more body.",
    seeAlso: { kind: "learn", anchor: "taste-body-title", label: TASTE },
    related: ["legs"],
    source: "general",
  },
  {
    id: "dry",
    term: "Dry",
    category: "tasting",
    definition: "A wine with little or no sugar left in it. Dry is about sweetness, not about the drying feeling of tannin.",
    seeAlso: { kind: "learn", anchor: "taste-sweetness-title", label: TASTE },
    related: ["off-dry", "residual-sugar"],
    source: "general",
  },
  {
    id: "off-dry",
    term: "Off-dry",
    category: "tasting",
    definition: "Just a touch sweet: enough sugar to soften the edges without tasting like dessert. Many Rieslings are made this way.",
    seeAlso: { kind: "learn", anchor: "taste-sweetness-title", label: TASTE },
    related: ["dry", "residual-sugar"],
    source: "general",
  },
  {
    id: "finish",
    term: "Finish",
    category: "tasting",
    definition: "How long the flavors linger after you swallow. A long finish is usually a sign of a well-made wine.",
    related: ["balance"],
    source: "general",
  },
  {
    id: "aroma",
    term: "Aroma",
    category: "tasting",
    definition: "The smells that come from the grape itself and from fermentation, like fruit, flowers or herbs. They're strongest in young wines.",
    related: ["bouquet"],
    source: "general",
  },
  {
    id: "bouquet",
    term: "Bouquet",
    category: "tasting",
    definition: "The more complex smells a wine develops as it ages in barrel or bottle, like leather, nuts, earth or dried fruit.",
    related: ["aroma", "cellaring"],
    source: "general",
  },
  {
    id: "legs",
    term: "Legs",
    category: "tasting",
    definition: "The streaks that run down the inside of the glass after you swirl. They hint at alcohol (and sometimes sugar), not quality.",
    related: ["body"],
    source: "general",
  },
  {
    id: "balance",
    term: "Balance",
    category: "tasting",
    definition: "When acidity, tannin, sweetness, alcohol and fruit all work together, with none sticking out. A balanced wine tastes whole rather than sharp, hot or flabby.",
    related: ["acidity", "tannin"],
    source: "general",
  },
  {
    id: "minerality",
    term: "Minerality",
    category: "tasting",
    definition: "Flavors that remind people of wet stone, chalk or flint, often in crisp whites from cool places. Where it comes from is still debated.",
    related: ["terroir"],
    source: "general",
  },
  // Winemaking
  {
    id: "fermentation",
    term: "Fermentation",
    category: "winemaking",
    definition: "Yeast turning grape sugar into alcohol and carbon dioxide. It's the step that turns juice into wine.",
    seeAlso: { kind: "learn", anchor: "vine-ferment-title", label: VINE },
    related: ["residual-sugar", "malolactic"],
    source: "general",
  },
  {
    id: "maceration",
    term: "Maceration",
    category: "winemaking",
    definition: "Soaking the juice with the grape skins to draw out color, tannin and flavor. Long for reds, a few hours for rosé, skipped for most whites.",
    seeAlso: { kind: "learn", anchor: "vine-crush-title", label: VINE },
    related: ["tannin"],
    source: "general",
  },
  {
    id: "malolactic",
    term: "Malolactic conversion",
    category: "winemaking",
    definition: "A secondary fermentation, by bacteria rather than yeast, that turns sharp, green-apple-like malic acid into softer lactic acid. Nearly all reds go through it, and it gives many Chardonnays their rounder, buttery feel.",
    seeAlso: { kind: "learn", anchor: "vine-ferment-title", label: VINE },
    related: ["acidity", "oak-aging"],
    source: "general",
  },
  {
    id: "lees",
    term: "Lees",
    category: "winemaking",
    definition: "The spent yeast that settles after fermentation. Aging a wine on its lees (\"sur lie\") adds a creamy texture and bready, nutty notes.",
    seeAlso: { kind: "learn", anchor: "vine-age-title", label: VINE },
    related: ["traditional-method"],
    source: "general",
  },
  {
    id: "oak-aging",
    term: "Oak aging",
    category: "winemaking",
    definition: "Resting wine in oak barrels, which let in a little air and add flavors like vanilla, toast and spice. New barrels flavor the wine more than old ones.",
    seeAlso: { kind: "learn", anchor: "vine-age-title", label: VINE },
    related: ["tannin", "malolactic"],
    source: "general",
  },
  {
    id: "residual-sugar",
    term: "Residual sugar",
    category: "winemaking",
    definition: "The grape sugar left in a wine when fermentation stops. It's what makes a wine taste sweet.",
    related: ["dry", "off-dry"],
    source: "general",
  },
  {
    id: "fortified",
    term: "Fortified",
    category: "winemaking",
    definition: "A wine with added grape spirit (brandy) that raises the alcohol, usually to 15–22%. Port, Sherry and Madeira are the classic examples.",
    seeAlso: { kind: "explore", params: { type: "fortified" }, label: "Browse fortified wines" },
    related: ["fermentation"],
    source: "general",
  },
  {
    id: "blend",
    term: "Blend",
    category: "winemaking",
    definition: "A wine made from more than one grape, like Bordeaux's mix of Cabernet Sauvignon and Merlot. Blending lets one grape's strengths cover another's weaknesses.",
    related: ["varietal"],
    source: "general",
  },
  {
    id: "sulfites",
    term: "Sulfites",
    category: "winemaking",
    definition: "Sulfur compounds that protect wine from spoiling and browning. Yeast makes a little on its own, and most winemakers add more along the way, especially before bottling.",
    related: ["oxidized"],
    source: "general",
  },
  {
    id: "traditional-method",
    term: "Traditional method",
    category: "winemaking",
    definition: "The Champagne way of making sparkling wine: a second fermentation inside the bottle traps the bubbles. Time on the lees gives toasty, bready notes.",
    seeAlso: { kind: "explore", params: { type: "sparkling" }, label: "Browse sparkling wines" },
    related: ["lees", "brut"],
    source: "general",
  },
  // Vineyard
  {
    id: "terroir",
    term: "Terroir",
    category: "vineyard",
    definition: "A vineyard's whole growing environment: climate, soil, slope and sunlight. It's why the same grape tastes different from place to place.",
    seeAlso: { kind: "learn", anchor: "vine-vineyard-title", label: VINE },
    related: ["appellation", "minerality"],
    source: "general",
  },
  {
    id: "vintage",
    term: "Vintage",
    category: "vineyard",
    definition: "The year the grapes were harvested. Weather changes every year, so the same wine can taste different from one vintage to the next.",
    seeAlso: { kind: "learn", anchor: "vine-harvest-title", label: VINE },
    related: ["non-vintage"],
    source: "general",
  },
  {
    id: "varietal",
    term: "Varietal",
    category: "vineyard",
    definition: "A wine named after, and mostly made from, a single grape, like a Pinot Noir or a Chardonnay. Common in the New World.",
    seeAlso: { kind: "learn", anchor: "grapes", label: "See it in Key Grapes" },
    related: ["blend", "vitis-vinifera"],
    source: "general",
  },
  {
    id: "vitis-vinifera",
    term: "Vitis vinifera",
    category: "vineyard",
    definition: "The European grape vine species behind nearly all the world's fine wine, from Cabernet Sauvignon to Riesling.",
    related: ["varietal", "phylloxera"],
    source: "general",
  },
  {
    id: "old-vines",
    term: "Old vines",
    category: "vineyard",
    definition: "Vines that are decades old, often labeled \"vieilles vignes.\" They give fewer grapes, which many growers think make more concentrated wine; there's no legal age.",
    related: ["terroir"],
    source: "general",
  },
  {
    id: "noble-rot",
    term: "Noble rot",
    category: "vineyard",
    definition: "A helpful mold (Botrytis cinerea) that shrivels ripe grapes and concentrates their sugar. It makes famous sweet wines like Sauternes and Tokaji.",
    seeAlso: { kind: "explore", params: { type: "dessert" }, label: "Browse dessert wines" },
    related: ["residual-sugar"],
    source: "general",
  },
  {
    id: "phylloxera",
    term: "Phylloxera",
    category: "vineyard",
    definition: "A tiny aphid-like insect that feeds on vine roots and destroyed most of Europe's vineyards in the late 1800s. Vines are still grafted onto resistant American roots to survive it.",
    related: ["vitis-vinifera"],
    source: "general",
  },
  {
    id: "climate",
    term: "Cool vs. warm climate",
    category: "vineyard",
    definition: "Cool places give wines with higher acidity, lighter body and tart fruit; warm places give riper fruit, more alcohol and fuller body.",
    related: ["acidity", "body"],
    source: "general",
  },
  // Label & Law
  {
    id: "appellation",
    term: "Appellation",
    category: "label",
    definition: "A legally defined wine region, like an AOC in France or an AVA in the United States. In Europe its rules can also set which grapes are allowed and how the wine is made.",
    related: ["terroir", "cru"],
    source: "general",
  },
  {
    id: "cru",
    term: "Grand Cru / Premier Cru",
    category: "label",
    definition: "French quality ranks. In Burgundy and Champagne they rank vineyards, with Grand Cru at the top and Premier Cru just below; in Bordeaux they rank châteaux, and there Premier Cru (First Growth) is the very top.",
    related: ["appellation"],
    source: "general",
  },
  {
    id: "non-vintage",
    term: "Non-vintage (NV)",
    category: "label",
    definition: "A wine blended from several harvests, so there's no year on the label. Most Champagne is made this way to keep a steady house style.",
    related: ["vintage", "blend"],
    source: "general",
  },
  {
    id: "old-world",
    term: "Old World",
    category: "label",
    definition: "Europe's traditional winemaking countries, like France, Italy, Spain and Germany. Labels usually name the place, and the wines lean earthier and more restrained.",
    seeAlso: { kind: "explore", params: { country: "France" }, label: "Browse wines from France" },
    related: ["new-world"],
    source: "general",
  },
  {
    id: "new-world",
    term: "New World",
    category: "label",
    definition: "Winemaking countries beyond Europe, like the United States, Australia, Chile and New Zealand. Labels usually name the grape, and the wines lean riper and fruit-forward.",
    seeAlso: { kind: "explore", params: { country: "United States" }, label: "Browse wines from the United States" },
    related: ["old-world"],
    source: "general",
  },
  {
    id: "estate-bottled",
    term: "Estate bottled",
    category: "label",
    definition: "The winery grew the grapes in its own vineyards and made and bottled the wine itself. In the US it's a legally defined label term.",
    related: ["appellation"],
    source: "general",
  },
  {
    id: "reserve",
    term: "Reserve",
    category: "label",
    definition: "A label word that usually suggests a better or longer-aged wine. In Spain and Italy (Reserva, Riserva) it has legal aging rules; in the US and many other places it has no legal meaning.",
    related: ["oak-aging"],
    source: "general",
  },
  {
    id: "brut",
    term: "Brut",
    category: "label",
    definition: "Dry, the most common sweetness level for sparkling wine. Extra Brut and Brut Nature are drier still; Extra Dry is, confusingly, a little sweeter.",
    seeAlso: { kind: "explore", params: { type: "sparkling" }, label: "Browse sparkling wines" },
    related: ["dry", "traditional-method"],
    source: "general",
  },
  // Serving
  {
    id: "decanting",
    term: "Decanting",
    category: "serving",
    definition: "Pouring wine into another vessel before serving, either to leave the sediment of an old wine behind or to let a young wine breathe.",
    related: ["aeration"],
    source: "general",
  },
  {
    id: "aeration",
    term: "Aeration",
    category: "serving",
    definition: "Letting air into a wine, by swirling, decanting or just letting it sit, so its aromas open up and harsh edges soften.",
    related: ["decanting"],
    source: "general",
  },
  {
    id: "serving-temperature",
    term: "Serving temperature",
    category: "serving",
    definition: "How cold a wine is changes how it tastes. Sparkling and light whites are best well chilled, fuller whites a little warmer, and reds just below room temperature.",
    source: "general",
  },
  {
    id: "corked",
    term: "Corked",
    category: "serving",
    definition: "A wine spoiled by a chemical called TCA, often from a tainted cork. It smells like wet cardboard or a musty basement, and the fruit is muted.",
    related: ["oxidized"],
    source: "general",
  },
  {
    id: "oxidized",
    term: "Oxidized",
    category: "serving",
    definition: "A wine that's had too much contact with air: flat, nutty and browning. Some styles, like Oloroso Sherry, tawny Port and Madeira, are made to taste this way on purpose.",
    related: ["sulfites", "corked"],
    source: "general",
  },
  {
    id: "cellaring",
    term: "Cellaring",
    category: "serving",
    definition: "Storing wine to age it: dark, steady and cool (about 55°F / 13°C), bottles on their side. Most wines are made to drink young; only some improve with years.",
    related: ["bouquet"],
    source: "general",
  },
];

const BY_ID = new Map(GLOSSARY_TERMS.map((term) => [term.id, term]));

export function termById(id: string): GlossaryTerm | undefined {
  return BY_ID.get(id);
}
