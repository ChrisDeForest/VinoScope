import type { ContentSource } from "./types";

/** The dataset's `type` values that differ in how they're made; Explore filters on these. */
export type WineStyle = "red" | "white" | "rosé" | "sparkling" | "fortified";
export const WINE_STYLES: readonly WineStyle[] = ["red", "white", "rosé", "sparkling", "fortified"];

export type StageId = "vineyard" | "harvest" | "crush" | "ferment" | "age" | "bottle" | "glass";

export interface StyleCalloutContent {
  style: WineStyle;
  text: string;
}

export interface VineStageContent {
  id: StageId;
  title: string;
  /** What happens at this stage. */
  what: string;
  /** How it shows up in what you taste. */
  why: string;
  callouts?: readonly StyleCalloutContent[];
  link?: { href: string; label: string };
  source: ContentSource;
}

export const VINE_CHAPTER = {
  id: "vine",
  label: "Vine to Glass",
  title: "From vine to glass",
  lead: "Every glass starts as a grape. Follow the vine down the page to see where the sweetness, acidity, tannin and body you just met actually come from.",
  source: "course",
} as const satisfies { id: "vine"; label: string; title: string; lead: string; source: ContentSource };

export const VINE_STAGES: readonly VineStageContent[] = [
  {
    id: "vineyard",
    title: "Vineyard",
    what: "Where grapes grow matters enormously. Climate, soil, sun, slope and aspect (the direction the slope faces) make up terroir, the sense of place the Old World prizes; the New World leans toward experiment. The vine's year runs bud break, flowering, fruit set, then véraison, when skins change color and sugar climbs as acid drops.",
    why: "Warm climates give riper grapes: more sugar, alcohol and body, lower acidity. Cool ones stay lighter, more delicate and higher in acid. Big day-to-night (diurnal) swings keep acidity bright even in sunny places.",
    source: "course",
  },
  {
    id: "harvest",
    title: "Harvest",
    what: "Picking traditionally starts about 100 days after flowering, once tests show sugar, acid and flavor in balance. Small or sloped vineyards are often hand-picked; others use machines. In hot places, crews may pick at night to keep the grapes cool.",
    why: "Pick late and the grapes are riper, which usually means a fuller, more alcoholic wine; pick early and it stays crisp and tart. This is the first place sweetness, acidity and body are decided.",
    source: "course",
  },
  {
    id: "crush",
    title: "Crush & Press",
    what: "At the winery the grapes are destemmed and gently crushed to break the skins and free the juice. Sulfur dioxide (SO₂) is added around the crush to slow oxidation and curb unwanted wild yeasts. Nearly all grape juice runs clear, whatever color the skins are.",
    why: "Color, and much of the tannin, lives in the skins, so what happens to them next decides the wine's style. Whites are pressed before fermentation; reds are pressed after.",
    callouts: [
      { style: "white", text: "Pressed right away, before fermentation, so the juice leaves the skins before it picks up any color." },
      { style: "rosé", text: "Left on the skins for just a few hours, long enough for a blush of color." },
      { style: "red", text: "The skins stay in with the juice for the next step." },
    ],
    source: "course",
  },
  {
    id: "ferment",
    title: "Fermentation",
    what: "The formula is sugar + yeast = alcohol + CO₂. Most fermentations take one to three weeks, in steel tanks or wooden vats.",
    why: "Let it finish and the wine is dry; stop it early and some sugar stays behind as sweetness. More sugar at the start means more alcohol and body. In cool years, makers may add sugar (chaptalization) to reach a normal alcohol level.",
    callouts: [
      { style: "red", text: "Ferments with its skins, soaking up color and tannin as it goes, and is pressed off its skins once fermentation finishes." },
      { style: "fortified", text: "For sweet styles like Port, brandy is added partway through, stopping the yeast and leaving the wine sweet and strong. Dry styles like Sherry are fortified after fermentation." },
    ],
    source: "course",
  },
  {
    id: "age",
    title: "Aging",
    what: "The new wine rests for months or years before bottling. Stainless steel tanks keep it sealed off from air; oak barrels let in a little oxygen and lend flavors of their own.",
    why: "Steel keeps a wine fresh and fruit-forward. Oak adds toast, spice and a touch of tannin: American oak is bolder, with vanilla, cinnamon, herbal and caramel notes; French oak has less impact.",
    source: "course",
  },
  {
    id: "bottle",
    title: "Blending & Bottling",
    what: "Winemakers often blend grapes or barrels to balance the final wine, then clarify it by fining and filtering, and bottle it. Sparkling wines need a bottle with a punt, the dent in the base that adds stability under pressure.",
    why: "Blending is how a winemaker fine-tunes the five scales: a little more acidity here, softer tannin there.",
    callouts: [
      { style: "sparkling", text: "In the traditional (Champagne) method, a second fermentation happens inside the sealed bottle, and its CO₂ is captured as the bubbles. Prosecco does that second fermentation in a pressurized tank instead." },
    ],
    source: "course",
  },
  {
    id: "glass",
    title: "In Your Glass",
    what: "Some wines keep improving in the bottle for years as their tannins soften; most are made to enjoy within a few years. Then it's served: people tend to pour whites too cold and reds too warm, and sparkling should be colder still. Hold the glass by the stem and pour no higher than its widest part.",
    why: "Everything upstream, from the vineyard's sunshine to the barrel, ends up as what you taste. Reds get the largest bowl to swirl and release aroma; sparkling suits a flute or tulip, and dessert wines a smaller glass.",
    link: { href: "#taste", label: "Now taste it: How to Taste" },
    source: "course",
  },
];
