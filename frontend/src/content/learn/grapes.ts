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
  /** Link wording when it must match the filter rather than the display name (e.g. "Syrah" for "Syrah / Shiraz"). */
  exploreLabel?: string;
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
  title: "Grapes to know",
  lead: "These grapes from class make many of the world's best-known wines. Pick one to see what it tastes like, where it grows best, and how to find it in the catalog.",
  source: "course",
} as const satisfies { id: "grapes"; label: string; title: string; lead: string; source: ContentSource };

export const DEFAULT_GRAPE_ID = "cabernet-sauvignon";

export const GRAPES: readonly GrapeContent[] = [
  {
    id: "cabernet-sauvignon",
    name: "Cabernet Sauvignon",
    color: "red",
    exploreGrape: "Cabernet Sauvignon",
    tagline: "The structured, age-worthy king of reds.",
    about: "Cabernet is the backbone of a Bordeaux blend, with high tannin and high acid, and it ages for years. It leads the blend on the Left Bank and is California's top red by volume, famous since Napa's win at the 1976 Judgment of Paris.",
    notes: ["blackcurrant", "black cherry", "cedar", "mint"],
    profile: { sweetness: 1, acidity: 4, tannin: 5, body: 5, fruitiness: 4 },
    regions: ["Bordeaux (Left Bank)", "Napa Valley", "Coonawarra", "Chile"],
    source: "course",
  },
  {
    id: "merlot",
    name: "Merlot",
    color: "red",
    exploreGrape: "Merlot",
    tagline: "Cabernet's softer, plusher partner.",
    about: "Merlot ripens earlier than Cabernet and softens earlier in the bottle, adding the \"flesh\" to a Bordeaux blend. It leads the Right Bank and is Bordeaux's most widely planted grape. In Washington it helped put the state on the map.",
    notes: ["plum", "black cherry", "cocoa"],
    profile: { sweetness: 1, acidity: 3, tannin: 3, body: 4, fruitiness: 4 },
    regions: ["Bordeaux (Right Bank: Pomerol, Saint-Émilion)", "Washington", "Long Island", "Napa Valley"],
    source: "course",
  },
  {
    id: "pinot-noir",
    name: "Pinot Noir",
    color: "red",
    exploreGrape: "Pinot Noir",
    tagline: "Thin-skinned, fussy and silky.",
    about: "Pinot Noir makes lighter-bodied reds with good acidity, and it does best in cooler areas. Burgundy's Côte de Nuits is said to make the best in the world, and Oregon's Willamette Valley earned the nickname \"Pinot-ville\" for it.",
    notes: ["red cherry", "raspberry", "mushroom", "earth"],
    profile: { sweetness: 1, acidity: 4, tannin: 2, body: 2, fruitiness: 3 },
    regions: ["Burgundy (Côte de Nuits)", "Willamette Valley", "Sonoma", "Central Otago"],
    source: "course",
  },
  {
    id: "syrah",
    name: "Syrah / Shiraz",
    color: "red",
    exploreGrape: "Syrah",
    exploreLabel: "Syrah",
    tagline: "Dark, peppery and bold. Called Shiraz in Australia.",
    about: "Syrah makes deeply colored, full-bodied wines, and Shiraz is the very same grape. In Australia it is ripe, jammy and high in alcohol, and it joins Grenache and Mourvèdre in GSM blends, a tribute to France's Rhône.",
    notes: ["blackberry", "black pepper", "smoked meat"],
    profile: { sweetness: 1, acidity: 3, tannin: 4, body: [4, 5], fruitiness: 4 },
    regions: ["Northern Rhône", "Barossa Valley", "Hunter Valley", "Washington"],
    source: "course",
  },
  {
    id: "cabernet-franc",
    name: "Cabernet Franc",
    color: "red",
    exploreGrape: "Cabernet Franc",
    tagline: "Lighter, peppery and herbal.",
    about: "Cabernet Franc brings pepper, tobacco and finesse to a blend, and it is the second red grape of Bordeaux's Right Bank after Merlot. It also does well in New York's cooler climate, where it grows around the state.",
    notes: ["red currant", "raspberry", "green bell pepper", "violet"],
    profile: { sweetness: 1, acidity: 4, tannin: 3, body: 3, fruitiness: 3 },
    regions: ["Loire (Chinon)", "Bordeaux (Right Bank blends)", "Finger Lakes", "Long Island"],
    source: "course",
  },
  {
    id: "malbec",
    name: "Malbec",
    color: "red",
    exploreGrape: "Malbec",
    tagline: "Argentina's showy signature red.",
    about: "Malbec is the star of Argentina, where most vineyards sit in Mendoza, high in the foothills of the Andes. Altitude and sunshine make ripe, showy wines. In Bordeaux it plays only a small part in blends.",
    notes: ["plum", "blackberry", "violet", "cocoa"],
    profile: { sweetness: 1, acidity: 3, tannin: 4, body: 4, fruitiness: 4 },
    regions: ["Mendoza", "Uco Valley", "Cahors", "Bordeaux (minor blending grape)"],
    source: "course",
  },
  {
    id: "sangiovese",
    name: "Sangiovese",
    color: "red",
    exploreGrape: "Sangiovese",
    tagline: "Tuscany's high-acid cherry red.",
    about: "Sangiovese is Tuscany's key red grape and the main grape in Chianti. Its high acid shows up as sour cherry, violets, leather and tobacco, and Brunello and Prugnolo are local names for its clones.",
    notes: ["sour cherry", "violets", "leather", "tobacco", "earth"],
    profile: { sweetness: 1, acidity: 5, tannin: 4, body: 3, fruitiness: 3 },
    regions: ["Chianti", "Brunello di Montalcino", "Vino Nobile di Montepulciano", "Super Tuscans"],
    source: "course",
  },
  {
    id: "tempranillo",
    name: "Tempranillo",
    color: "red",
    exploreGrape: "Tempranillo",
    tagline: "Spain's oak-aged red.",
    about: "Tempranillo ripens early and is Spain's major red grape, often blended with Garnacha in Rioja. American oak adds vanilla, cinnamon and caramel, and a Rioja label tells you the aging: Joven, Crianza, Reserva or Gran Reserva.",
    notes: ["red cherry", "plum", "leather", "vanilla"],
    profile: { sweetness: 1, acidity: 3, tannin: 4, body: 4, fruitiness: 3 },
    regions: ["Rioja", "Ribera del Duero (as Tinto Fino)", "Portugal (as Aragonez or Tinta Roriz)", "Argentina"],
    source: "course",
  },
  {
    id: "zinfandel",
    name: "Zinfandel",
    color: "red",
    exploreGrape: "Zinfandel",
    tagline: "California's heritage grape, jammy and spicy.",
    about: "Zinfandel is a heritage grape that came to California with the Gold Rush, and in Italy it goes by Primitivo. It runs from simple to complex, and \"old vine\" bottles come from low yields and have big flavor. It is also made into sweet, pink White Zinfandel.",
    notes: ["blackberry jam", "raspberry", "black pepper", "spice"],
    profile: { sweetness: [1, 2], acidity: 3, tannin: 3, body: 5, fruitiness: 5 },
    regions: ["Sierra Foothills", "Paso Robles", "Lodi", "Italy (as Primitivo)"],
    source: "course",
  },
  {
    id: "grenache",
    name: "Grenache",
    color: "red",
    exploreGrape: "Grenache",
    tagline: "Soft, fruity and spicy, and a team player.",
    about: "Grenache is called Garnacha in Spain, where it is often blended with Tempranillo in Rioja. In France it is the backbone of the Southern Rhône, including Châteauneuf-du-Pape. It is the \"G\" in the GSM blends of Australia and California, which pay tribute to France's Rhône.",
    notes: ["strawberry", "raspberry", "white pepper", "dried herbs"],
    profile: { sweetness: 1, acidity: 2, tannin: 2, body: 4, fruitiness: 4 },
    regions: ["Southern Rhône (Châteauneuf-du-Pape)", "Spain (as Garnacha)", "Barossa Valley (GSM blends)", "San Luis Obispo (Rhône blends)"],
    source: "course",
  },
  {
    id: "chardonnay",
    name: "Chardonnay",
    color: "white",
    exploreGrape: "Chardonnay",
    tagline: "The shape-shifter of white wine.",
    about: "Chardonnay changes with where it grows and how it is made. Chablis is crisp and usually unoaked, while Côte de Beaune and California wines are richer and oakier, and malolactic conversion adds a buttery note. It is also a key grape in Champagne.",
    notes: ["apple", "lemon", "pineapple", "butter", "vanilla"],
    profile: { sweetness: 1, acidity: [3, 4], tannin: 1, body: [2, 4], fruitiness: 3 },
    regions: ["Burgundy (Chablis, Meursault)", "California", "Australia"],
    source: "course",
  },
  {
    id: "sauvignon-blanc",
    name: "Sauvignon Blanc",
    color: "white",
    exploreGrape: "Sauvignon Blanc",
    tagline: "Zesty, aromatic and green.",
    about: "Sauvignon Blanc is high in acid and pungent, with citrus, gooseberry and grassy notes. New Zealand's Marlborough is famous for it, usually unoaked. In California it is also sold as Fumé Blanc, a name Robert Mondavi created.",
    notes: ["grapefruit", "green apple", "cut grass", "passion fruit"],
    profile: { sweetness: 1, acidity: 5, tannin: 1, body: 2, fruitiness: 4 },
    regions: ["Marlborough", "Loire (Sancerre)", "Bordeaux (blended with Sémillon)", "California (Fumé Blanc)"],
    source: "course",
  },
  {
    id: "riesling",
    name: "Riesling",
    color: "white",
    exploreGrape: "Riesling",
    tagline: "Electric acidity, from bone dry to lusciously sweet.",
    about: "Riesling is high in acid and light to medium in body, and it is usually unoaked. It is made in styles from dry to dessert, including late harvest and ice wine, and the best age for a long time, picking up honey and petrol notes.",
    notes: ["lime", "green apple", "peach", "honey", "petrol (with age)"],
    profile: { sweetness: [1, 5], acidity: 5, tannin: 1, body: 2, fruitiness: 4 },
    regions: ["Germany (Mosel)", "Alsace", "Finger Lakes", "Washington"],
    source: "course",
  },
  {
    id: "semillon",
    name: "Sémillon",
    color: "white",
    exploreGrape: "Semillon",
    tagline: "Rich and honeyed, from sweet Sauternes to dry whites.",
    about: "Sémillon adds weight, roundness and depth to dry white Bordeaux. Botrytis, or noble rot, concentrates its sugar into the famous sweet wines of Sauternes. Australia makes aged versions too.",
    notes: ["lemon", "honey", "beeswax", "toast"],
    profile: { sweetness: [1, 5], acidity: 3, tannin: 1, body: 4, fruitiness: 3 },
    regions: ["Sauternes", "Bordeaux (dry whites)", "Hunter Valley", "Washington"],
    source: "course",
  },
  {
    id: "moscato",
    name: "Moscato / Muscat",
    color: "white",
    exploreGrape: "Moscato",
    exploreLabel: "Moscato",
    tagline: "Sweet, floral and fruity.",
    about: "Moscato makes sweet, aromatic wines. Asti in Piedmont is almost always sweet and sparkling, and California used Muscat of Alexandria for its popular sweeter wines. In Jerez, Moscatel is one of the grapes used for sweeter Sherry.",
    notes: ["orange blossom", "peach", "grape", "honeysuckle"],
    profile: { sweetness: [2, 5], acidity: 2, tannin: 1, body: [1, 3], fruitiness: 5 },
    regions: ["Asti", "California", "Jerez (Moscatel)", "Rutherglen"],
    source: "course",
  },
];
