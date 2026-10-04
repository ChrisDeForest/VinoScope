import { GRAPES } from "./grapes";
import type { ContentSource } from "./types";

/** Growing climate on a five-step scale: 1 = cold, 5 = hot. */
export type Climate = 1 | 2 | 3 | 4 | 5;
export type LonLat = readonly [number, number];

export interface MapCountry {
  /** URL-safe slug; also the deep-link anchor (`#country-<id>`). */
  id: string;
  name: string;
  /** The country's name in the map data (world-atlas). */
  atlasName: string;
  /** Value for Explore's `country` filter. */
  exploreCountry: string;
  overview: string;
  /** `[[west, south], [east, north]]` in degrees: what the map zooms to (mainland, lower 48, …). */
  fitBounds: readonly [LonLat, LonLat];
  source: ContentSource;
}

export interface MapRegion {
  /** URL-safe slug; also the deep-link anchor (`#region-<id>`). */
  id: string;
  name: string;
  countryId: string;
  /** Pin position, `[longitude, latitude]`. */
  coords: LonLat;
  /** Value for Explore's `region` filter (the catalog's own region name), or null when the catalog has none. */
  exploreRegion: string | null;
  /** Link wording when the catalog's name differs from the display name (e.g. "California" for "Napa & Sonoma"). */
  exploreLabel?: string;
  about: string;
  climate: Climate;
  climateLabel: string;
  grapes: readonly string[];
  styles: readonly string[];
  /** "Worth knowing". */
  fact: string;
  source: ContentSource;
}

export const REGIONS_CHAPTER = {
  id: "regions",
  label: "Wine Regions",
  title: "Where wine comes from",
  lead: "Every wine tastes of the place it was grown. Pick a country to fly in, then a region to see its climate, its grapes and the wines it's famous for.",
  source: "general",
} as const satisfies { id: "regions"; label: string; title: string; lead: string; source: ContentSource };

export const MAP_COUNTRIES: readonly MapCountry[] = [
  {
    id: "united-states",
    name: "United States",
    atlasName: "United States of America",
    exploreCountry: "United States",
    overview: "Wine is made in all fifty states, but California makes most of it, with Oregon and Washington close behind. Labels usually name the grape, and sunny weather gives ripe, generous wines.",
    fitBounds: [[-125, 24.5], [-66.9, 49.4]],
    source: "general",
  },
  {
    id: "italy",
    name: "Italy",
    atlasName: "Italy",
    exploreCountry: "Italy",
    overview: "Italy has more native grapes than any other country, from Piedmont's Nebbiolo to Tuscany's Sangiovese. Its wines are made for the table, with bright acidity to match food.",
    fitBounds: [[6.6, 36.6], [18.6, 47.1]],
    source: "general",
  },
  {
    id: "france",
    name: "France",
    atlasName: "France",
    exploreCountry: "France",
    overview: "The benchmark for much of the wine world: Bordeaux, Burgundy and Champagne set the styles others are measured against. French labels name the place, not the grape.",
    fitBounds: [[-5.2, 41.3], [9.6, 51.1]],
    source: "general",
  },
  {
    id: "germany",
    name: "Germany",
    atlasName: "Germany",
    exploreCountry: "Germany",
    overview: "One of the coolest places to grow wine, famous for Riesling on steep river slopes. Its wines run from bone dry to lusciously sweet, always with high acidity.",
    fitBounds: [[5.9, 47.3], [15.0, 55.1]],
    source: "general",
  },
  {
    id: "portugal",
    name: "Portugal",
    atlasName: "Portugal",
    exploreCountry: "Portugal",
    overview: "Home of Port, the fortified wine of the Douro Valley, and Madeira from its Atlantic island. It also grows hundreds of native grapes for its everyday table wines.",
    fitBounds: [[-17.3, 32.6], [-6.2, 42.2]],
    source: "general",
  },
  {
    id: "spain",
    name: "Spain",
    atlasName: "Spain",
    exploreCountry: "Spain",
    overview: "Spain has more land under vine than any other country. Tempranillo leads its reds, and the hot south makes Sherry, the world's most famous fortified white.",
    fitBounds: [[-9.4, 35.9], [3.4, 43.8]],
    source: "general",
  },
  {
    id: "canada",
    name: "Canada",
    atlasName: "Canada",
    exploreCountry: "Canada",
    overview: "A cold-climate country best known for icewine, made from grapes frozen on the vine. Most of its wine comes from Ontario's Niagara Peninsula and British Columbia.",
    fitBounds: [[-130, 41.7], [-52.6, 56]],
    source: "general",
  },
  {
    id: "argentina",
    name: "Argentina",
    atlasName: "Argentina",
    exploreCountry: "Argentina",
    overview: "Vineyards sit high in the foothills of the Andes, where sunny days and cold nights make bold, ripe reds. Malbec, originally from France, became its signature grape.",
    fitBounds: [[-73.6, -55.1], [-53.6, -21.8]],
    source: "general",
  },
  {
    id: "hungary",
    name: "Hungary",
    atlasName: "Hungary",
    exploreCountry: "Hungary",
    overview: "Famous for Tokaji, one of the world's oldest sweet wines, made from grapes shriveled by noble rot. It also grows native grapes like Furmint for dry whites.",
    fitBounds: [[16.1, 45.7], [22.9, 48.6]],
    source: "general",
  },
  {
    id: "chile",
    name: "Chile",
    atlasName: "Chile",
    exploreCountry: "Chile",
    overview: "A long, thin country squeezed between the Andes and the Pacific, with sunny valleys cooled by ocean breezes. It's known for good-value Cabernet Sauvignon and its own Carménère.",
    fitBounds: [[-75.7, -55.9], [-66.4, -17.5]],
    source: "general",
  },
  {
    id: "australia",
    name: "Australia",
    atlasName: "Australia",
    exploreCountry: "Australia",
    overview: "Warm, sunny and inventive, Australia made Shiraz world-famous with rich, ripe reds. Its cooler corners grow Riesling, Chardonnay and Pinot Noir.",
    fitBounds: [[113, -43.7], [153.7, -10.7]],
    source: "general",
  },
  {
    id: "new-zealand",
    name: "New Zealand",
    atlasName: "New Zealand",
    exploreCountry: "New Zealand",
    overview: "A cool, maritime country whose zesty Sauvignon Blanc took the world by storm. Pinot Noir from the South Island is its other star.",
    fitBounds: [[166.4, -47.3], [178.6, -34.4]],
    source: "general",
  },
  {
    id: "south-africa",
    name: "South Africa",
    atlasName: "South Africa",
    exploreCountry: "South Africa",
    overview: "Wine has been made at the southern tip of Africa since the 1600s, cooled by two oceans. Chenin Blanc is its most planted white, and Pinotage is its own red grape.",
    fitBounds: [[16.4, -34.9], [32.9, -22.1]],
    source: "general",
  },
];

export const MAP_REGIONS: readonly MapRegion[] = [
  // United States
  {
    id: "napa-sonoma",
    name: "Napa & Sonoma",
    countryId: "united-states",
    coords: [-122.4, 38.4],
    exploreRegion: "California",
    exploreLabel: "California",
    about: "Two neighboring valleys north of San Francisco that made California wine famous. Warm days give ripe fruit, while fog from the Pacific cools the nights.",
    climate: 4,
    climateLabel: "Warm, with cooling fog",
    grapes: ["Cabernet Sauvignon", "Chardonnay", "Pinot Noir", "Zinfandel"],
    styles: ["Full-bodied reds", "Oaked whites"],
    fact: "At the 1976 “Judgment of Paris,” Napa wines beat top French wines in a blind tasting.",
    source: "general",
  },
  {
    id: "willamette",
    name: "Willamette Valley",
    countryId: "united-states",
    coords: [-123.1, 45.0],
    exploreRegion: "Oregon",
    exploreLabel: "Oregon",
    about: "Oregon's main wine valley is cool and often rainy, at about the same latitude as Burgundy. That's why it's best known for Pinot Noir.",
    climate: 2,
    climateLabel: "Cool, with wet winters",
    grapes: ["Pinot Noir", "Pinot Gris", "Chardonnay"],
    styles: ["Light, elegant reds", "Crisp whites"],
    fact: "Burgundy producers have bought vineyards here because the conditions are so similar to home.",
    source: "general",
  },
  {
    id: "washington",
    name: "Washington",
    countryId: "united-states",
    coords: [-119.5, 46.3],
    exploreRegion: "Washington",
    about: "Most vineyards lie east of the Cascade Mountains, in dry, near-desert country watered by irrigation. Long summer days ripen the grapes fully, while cold nights keep their acidity.",
    climate: 3,
    climateLabel: "Dry, with sunny days and cold nights",
    grapes: ["Cabernet Sauvignon", "Merlot", "Syrah", "Riesling"],
    styles: ["Structured reds", "Off-dry Riesling"],
    fact: "It's the second-largest wine-producing state in the US, after California.",
    source: "general",
  },
  // Italy
  {
    id: "piedmont",
    name: "Piedmont",
    countryId: "italy",
    coords: [8.0, 44.7],
    exploreRegion: "Piedmont",
    about: "In Italy's northwest, at the foot of the Alps, fog rolls over the hills each autumn. Nebbiolo, named after that fog (nebbia), makes Barolo and Barbaresco.",
    climate: 2,
    climateLabel: "Cool to moderate, with foggy autumns",
    grapes: ["Nebbiolo", "Barbera", "Moscato"],
    styles: ["Tannic, age-worthy reds", "Sweet, fizzy Moscato d'Asti"],
    fact: "Barolo is nicknamed “the king of wines” and must age for at least three years before release.",
    source: "general",
  },
  {
    id: "tuscany",
    name: "Tuscany",
    countryId: "italy",
    coords: [11.2, 43.4],
    exploreRegion: "Tuscany",
    about: "Rolling hills in central Italy, home of Chianti, Brunello di Montalcino and the “Super Tuscans.” Sangiovese is the grape behind almost all of its classic reds.",
    climate: 4,
    climateLabel: "Warm and sunny, Mediterranean",
    grapes: ["Sangiovese", "Cabernet Sauvignon", "Merlot"],
    styles: ["Savory, high-acid reds", "Bold red blends"],
    fact: "Super Tuscans began in the 1970s, when winemakers broke the local rules to blend in French grapes.",
    source: "general",
  },
  {
    id: "veneto",
    name: "Veneto",
    countryId: "italy",
    coords: [11.9, 45.5],
    exploreRegion: "Veneto",
    about: "Northeast Italy, around Venice and Verona. It makes everything from fizzy Prosecco to Amarone, a powerful red made from grapes dried on mats for months.",
    climate: 3,
    climateLabel: "Moderate, cooled by the Alps and Lake Garda",
    grapes: ["Glera", "Corvina", "Garganega"],
    styles: ["Prosecco", "Amarone", "Soave"],
    fact: "Drying the grapes for Amarone takes about three to four months and shrinks them by roughly a third.",
    source: "general",
  },
  {
    id: "emilia-romagna",
    name: "Emilia-Romagna",
    countryId: "italy",
    coords: [11.0, 44.5],
    exploreRegion: "Emilia-Romagna",
    about: "Italy's food heartland, home of Parmigiano-Reggiano and prosciutto. Its signature wine is Lambrusco, a fizzy, fruity red made to cut through rich food.",
    climate: 3,
    climateLabel: "Moderate, on a broad river plain",
    grapes: ["Lambrusco", "Sangiovese", "Trebbiano"],
    styles: ["Sparkling red Lambrusco"],
    fact: "Lambrusco can be dry or sweet; look for “secco” on the label if you want it dry.",
    source: "general",
  },
  // France
  {
    id: "bordeaux",
    name: "Bordeaux",
    countryId: "france",
    coords: [-0.6, 44.8],
    exploreRegion: "Bordeaux",
    about: "Here the Gironde estuary splits the land in two. The Left Bank's gravel suits Cabernet Sauvignon and the Right Bank's clay suits Merlot, and most reds are blends of both.",
    climate: 3,
    climateLabel: "Moderate, maritime",
    grapes: ["Cabernet Sauvignon", "Merlot", "Cabernet Franc", "Sauvignon Blanc", "Sémillon"],
    styles: ["Red blends", "Sweet Sauternes", "Dry whites"],
    fact: "The 1855 classification still ranks the top Médoc châteaux, from First to Fifth Growth.",
    source: "general",
  },
  {
    id: "burgundy",
    name: "Burgundy",
    countryId: "france",
    coords: [4.8, 47.0],
    exploreRegion: "Burgundy",
    about: "A narrow strip of east-facing slopes where monks mapped the vineyards plot by plot centuries ago. Red Burgundy is Pinot Noir, and white Burgundy is Chardonnay.",
    climate: 2,
    climateLabel: "Cool, continental",
    grapes: ["Pinot Noir", "Chardonnay"],
    styles: ["Elegant reds", "Mineral whites", "Chablis"],
    fact: "Burgundy ranks its vineyards plot by plot: village, then Premier Cru, then Grand Cru at the top.",
    source: "general",
  },
  {
    id: "champagne",
    name: "Champagne",
    countryId: "france",
    coords: [4.0, 49.0],
    exploreRegion: "Champagne",
    about: "France's northernmost classic region, so cool that the grapes barely ripen, which suits sparkling wine perfectly. Only sparkling wine from here may be called Champagne.",
    climate: 1,
    climateLabel: "Cold, continental",
    grapes: ["Chardonnay", "Pinot Noir", "Pinot Meunier"],
    styles: ["Brut Champagne", "Blanc de blancs", "Rosé Champagne"],
    fact: "Miles of chalk cellars run beneath the towns of Reims and Épernay, keeping the bottles cool as they age.",
    source: "general",
  },
  {
    id: "rhone",
    name: "Rhône",
    countryId: "france",
    coords: [4.8, 44.6],
    exploreRegion: "Rhone",
    exploreLabel: "Rhône",
    about: "The Rhône River runs south from Lyon toward the Mediterranean. The steep, cooler north grows Syrah; the warm, sunny south makes generous blends like Châteauneuf-du-Pape.",
    climate: 4,
    climateLabel: "Moderate in the north, warm Mediterranean in the south",
    grapes: ["Syrah", "Grenache", "Mourvèdre", "Viognier"],
    styles: ["Peppery Syrah", "Grenache blends"],
    fact: "Châteauneuf-du-Pape allows thirteen different grape varieties in its blend.",
    source: "general",
  },
  {
    id: "loire",
    name: "Loire",
    countryId: "france",
    coords: [0.7, 47.3],
    exploreRegion: null,
    about: "France's longest river is lined with castles and vineyards for hundreds of miles. Cool and fresh, it's known for crisp whites like Sancerre and Vouvray.",
    climate: 2,
    climateLabel: "Cool, maritime to continental",
    grapes: ["Sauvignon Blanc", "Chenin Blanc", "Cabernet Franc", "Melon de Bourgogne"],
    styles: ["Crisp whites", "Light reds", "Sparkling Crémant"],
    fact: "Muscadet, made where the river meets the sea, is often aged “sur lie” for extra texture.",
    source: "general",
  },
  {
    id: "alsace",
    name: "Alsace",
    countryId: "france",
    coords: [7.3, 48.2],
    exploreRegion: "Alsace",
    about: "Tucked between the Vosges Mountains and the Rhine on the German border. The mountains block the rain, making it one of France's driest wine regions.",
    climate: 2,
    climateLabel: "Cool, but dry and sunny",
    grapes: ["Riesling", "Gewürztraminer", "Pinot Gris"],
    styles: ["Aromatic whites", "Late-harvest sweet wines"],
    fact: "Alsace is one of the few French regions that puts the grape's name on the label.",
    source: "general",
  },
  {
    id: "provence",
    name: "Provence",
    countryId: "france",
    coords: [6.0, 43.5],
    exploreRegion: "Provence",
    about: "Sunny southeastern France along the Mediterranean, scented with wild herbs. It's the world's most famous home of dry, pale rosé.",
    climate: 4,
    climateLabel: "Hot and dry, Mediterranean",
    grapes: ["Grenache", "Cinsault", "Mourvèdre"],
    styles: ["Pale, dry rosé"],
    fact: "Roughly nine in ten bottles from Provence are rosé.",
    source: "general",
  },
  // Germany
  {
    id: "mosel",
    name: "Mosel",
    countryId: "germany",
    coords: [6.9, 49.9],
    exploreRegion: "Mosel",
    about: "Vineyards cling to some of the world's steepest slopes along the winding Mosel River. Slate soils soak up the day's heat, helping Riesling ripen this far north.",
    climate: 1,
    climateLabel: "Cold, continental",
    grapes: ["Riesling"],
    styles: ["Light, low-alcohol Riesling", "Sweet Spätlese and Auslese"],
    fact: "Some slopes are so steep that the vines are tended entirely by hand, with tiny monorails to haul the grapes.",
    source: "general",
  },
  {
    id: "rheingau",
    name: "Rheingau",
    countryId: "germany",
    coords: [8.0, 50.0],
    exploreRegion: "Rheingau",
    about: "Here the Rhine turns west for a stretch, so the vineyards face south toward the sun. It makes fuller, often drier Rieslings than the Mosel.",
    climate: 2,
    climateLabel: "Cool, sheltered by the Taunus hills",
    grapes: ["Riesling", "Pinot Noir"],
    styles: ["Dry Riesling", "Sweet late-harvest Riesling"],
    fact: "Late-harvest wine was born at Schloss Johannisberg in 1775, when the messenger bringing permission to pick arrived weeks late.",
    source: "general",
  },
  // Portugal
  {
    id: "douro",
    name: "Douro",
    countryId: "portugal",
    coords: [-7.6, 41.2],
    exploreRegion: "Douro",
    about: "Steep terraced hills line the Douro River in northern Portugal, baking hot in summer. It's the home of Port and, more and more, of rich dry reds.",
    climate: 5,
    climateLabel: "Hot, dry summers",
    grapes: ["Touriga Nacional", "Touriga Franca", "Tinta Roriz"],
    styles: ["Port", "Dry red blends"],
    fact: "In 1756 the Douro became one of the world's first officially mapped wine regions.",
    source: "general",
  },
  {
    id: "madeira",
    name: "Madeira",
    countryId: "portugal",
    coords: [-16.95, 32.75],
    exploreRegion: "Madeira",
    about: "A subtropical island in the Atlantic, off the coast of Morocco. Its fortified wine is heated as it ages, which makes it almost indestructible once opened.",
    climate: 4,
    climateLabel: "Warm and humid, subtropical",
    grapes: ["Sercial", "Verdelho", "Bual", "Malmsey"],
    styles: ["Fortified Madeira, dry to sweet"],
    fact: "Madeira was the wine used to toast the US Declaration of Independence in 1776.",
    source: "general",
  },
  // Spain
  {
    id: "rioja",
    name: "Rioja",
    countryId: "spain",
    coords: [-2.5, 42.4],
    exploreRegion: "Rioja",
    about: "Spain's best-known red wine region, along the Ebro River in the north. Its reds are traditionally aged in American oak, which adds vanilla and coconut notes.",
    climate: 3,
    climateLabel: "Moderate, sheltered by mountains",
    grapes: ["Tempranillo", "Garnacha", "Graciano"],
    styles: ["Oak-aged reds: Crianza, Reserva, Gran Reserva"],
    fact: "A Gran Reserva red must age at least five years before release, two of them in oak.",
    source: "general",
  },
  {
    id: "ribera-del-duero",
    name: "Ribera del Duero",
    countryId: "spain",
    coords: [-3.8, 41.65],
    exploreRegion: "Castilla y Leon",
    exploreLabel: "Castilla y León",
    about: "A high plateau in Castilla y León with scorching days and icy nights. Tempranillo, called Tinto Fino here, makes dark, powerful reds.",
    climate: 4,
    climateLabel: "Extreme: hot days, cold nights",
    grapes: ["Tempranillo"],
    styles: ["Bold, structured reds"],
    fact: "Vega Sicilia, one of Spain's most famous wineries, has made wine here since the 1800s.",
    source: "general",
  },
  {
    id: "jerez",
    name: "Jerez",
    countryId: "spain",
    coords: [-6.1, 36.7],
    exploreRegion: "Andalusia",
    exploreLabel: "Andalusia",
    about: "The hot, chalky corner of Andalusia where Sherry is made. Some Sherries age under a layer of yeast called flor; others are exposed to air for nutty flavors.",
    climate: 5,
    climateLabel: "Hot, with Atlantic breezes",
    grapes: ["Palomino", "Pedro Ximénez", "Moscatel"],
    styles: ["Fino", "Amontillado", "Oloroso", "Sweet PX"],
    fact: "Sherry ages in a solera, a stack of barrels where younger wine is blended into older wine over many years.",
    source: "general",
  },
  // Canada
  {
    id: "niagara",
    name: "Niagara",
    countryId: "canada",
    coords: [-79.2, 43.1],
    exploreRegion: "Ontario",
    exploreLabel: "Ontario",
    about: "The Niagara Peninsula sits between Lake Ontario and Lake Erie, which keep its winters milder than you'd expect. It's famous for icewine from grapes frozen on the vine.",
    climate: 1,
    climateLabel: "Cold winters, softened by the lakes",
    grapes: ["Riesling", "Vidal", "Chardonnay", "Cabernet Franc"],
    styles: ["Icewine", "Crisp whites"],
    fact: "Icewine grapes are picked frozen solid, at −8 °C (17 °F) or colder, often in the middle of the night.",
    source: "general",
  },
  // Argentina
  {
    id: "mendoza",
    name: "Mendoza",
    countryId: "argentina",
    coords: [-68.8, -33.0],
    exploreRegion: "Mendoza",
    about: "About 70% of Argentina's wine comes from here, in high desert at the foot of the Andes. Snowmelt waters the vines, and strong sun with cool nights makes bold reds.",
    climate: 4,
    climateLabel: "Sunny and dry, at high altitude",
    grapes: ["Malbec", "Cabernet Sauvignon", "Torrontés"],
    styles: ["Rich Malbec"],
    fact: "Some vineyards sit more than 1,500 meters (about 5,000 feet) above sea level.",
    source: "general",
  },
  // Hungary
  {
    id: "tokaj",
    name: "Tokaj",
    countryId: "hungary",
    coords: [21.4, 48.1],
    exploreRegion: "Tokaj",
    about: "Hills in northeast Hungary where autumn mists encourage noble rot. The shriveled aszú grapes make Tokaji Aszú, a golden, honeyed sweet wine.",
    climate: 2,
    climateLabel: "Cool continental, with misty autumns",
    grapes: ["Furmint", "Hárslevelű"],
    styles: ["Tokaji Aszú", "Dry Furmint"],
    fact: "Tokaj's vineyards were classified in the 1700s, long before Bordeaux's famous 1855 ranking.",
    source: "general",
  },
  // Chile
  {
    id: "colchagua",
    name: "Colchagua",
    countryId: "chile",
    coords: [-71.2, -34.6],
    exploreRegion: "Colchagua Valley",
    exploreLabel: "Colchagua Valley",
    about: "A warm valley in Chile's Central Valley that opens west toward the Pacific. It's known for ripe, rich reds.",
    climate: 4,
    climateLabel: "Warm, Mediterranean",
    grapes: ["Cabernet Sauvignon", "Carménère", "Syrah"],
    styles: ["Full-bodied reds"],
    fact: "Carménère, wiped out in Bordeaux, was rediscovered in Chile in 1994, where it had been mistaken for Merlot.",
    source: "general",
  },
  // Australia
  {
    id: "barossa",
    name: "Barossa Valley",
    countryId: "australia",
    coords: [139.0, -34.5],
    exploreRegion: "South Australia",
    exploreLabel: "South Australia",
    about: "A warm valley in South Australia settled by German immigrants in the 1840s. Some of the world's oldest Shiraz vines still grow here.",
    climate: 4,
    climateLabel: "Warm and dry",
    grapes: ["Shiraz", "Grenache", "Riesling"],
    styles: ["Rich, ripe Shiraz"],
    fact: "Phylloxera never reached South Australia, so some vines here are more than 150 years old.",
    source: "general",
  },
  // New Zealand
  {
    id: "marlborough",
    name: "Marlborough",
    countryId: "new-zealand",
    coords: [173.8, -41.5],
    exploreRegion: "Marlborough",
    about: "The sunny northeast tip of the South Island, with cool nights and stony soils. Its punchy, tropical Sauvignon Blanc put New Zealand on the wine map.",
    climate: 2,
    climateLabel: "Cool and sunny",
    grapes: ["Sauvignon Blanc", "Pinot Noir"],
    styles: ["Zesty Sauvignon Blanc"],
    fact: "The first Sauvignon Blanc vines here were planted only in the 1970s.",
    source: "general",
  },
  // South Africa
  {
    id: "stellenbosch",
    name: "Stellenbosch",
    countryId: "south-africa",
    coords: [18.86, -33.93],
    exploreRegion: "Western Cape",
    exploreLabel: "Western Cape",
    about: "Mountains and valleys near Cape Town, cooled by breezes off False Bay. It's South Africa's best-known region for reds.",
    climate: 3,
    climateLabel: "Warm, cooled by the ocean",
    grapes: ["Cabernet Sauvignon", "Pinotage", "Chenin Blanc"],
    styles: ["Red blends", "Pinotage"],
    fact: "Pinotage was created at Stellenbosch University in 1925 by crossing Pinot Noir with Cinsault.",
    source: "general",
  },
];

const COUNTRY_BY_ID = new Map(MAP_COUNTRIES.map((country) => [country.id, country]));
const REGION_BY_ID = new Map(MAP_REGIONS.map((region) => [region.id, region]));

export function countryById(id: string): MapCountry | undefined {
  return COUNTRY_BY_ID.get(id);
}

export function regionById(id: string): MapRegion | undefined {
  return REGION_BY_ID.get(id);
}

export function regionsOf(countryId: string): MapRegion[] {
  return MAP_REGIONS.filter((region) => region.countryId === countryId);
}

// Key Grapes names Syrah "Syrah / Shiraz"; regions use whichever name is local.
const KEY_GRAPE_ALIASES: Record<string, string> = { Syrah: "syrah", Shiraz: "syrah" };

export function keyGrapeId(name: string): string | null {
  return GRAPES.find((grape) => grape.name === name)?.id ?? KEY_GRAPE_ALIASES[name] ?? null;
}
