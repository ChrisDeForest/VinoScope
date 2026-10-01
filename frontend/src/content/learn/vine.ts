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
  source: "general",
} as const satisfies { id: "vine"; label: string; title: string; lead: string; source: ContentSource };

export const VINE_STAGES: readonly VineStageContent[] = [
  {
    id: "vineyard",
    title: "Vineyard",
    what: "Grapes are farmed like any fruit, but where they grow matters enormously. Climate, soil, sunlight and slope, together called terroir, shape how ripe the grapes get. A new vine takes about three years to bear fruit worth making into wine.",
    why: "Warm, sunny places give riper grapes: more sugar, more alcohol and body, softer acidity. Cool places keep acidity bright and fruit more restrained.",
    source: "general",
  },
  {
    id: "harvest",
    title: "Harvest",
    what: "In late summer or fall, growers taste and test the grapes and pick when sugar and acidity are in balance. Some vineyards harvest by hand, cluster by cluster; others use machines that shake the berries loose.",
    why: "Pick late and the grapes are riper, which usually means a fuller, more alcoholic wine; pick early and it stays crisp and tart. This is the first place sweetness, acidity and body are decided.",
    source: "general",
  },
  {
    id: "crush",
    title: "Crush & Press",
    what: "At the winery the grapes are pulled off their stems and gently crushed to break the skins and free the juice. Nearly all grape juice runs clear, whatever color the skins are.",
    why: "Color, and much of the tannin, lives in the skins, so what happens to them next decides the wine's style.",
    callouts: [
      { style: "white", text: "Pressed right away, so the juice leaves the skins before it picks up any color." },
      { style: "rosé", text: "Left on the skins for just a few hours, long enough for a blush of color." },
      { style: "red", text: "The skins stay in with the juice for the next step." },
    ],
    source: "general",
  },
  {
    id: "ferment",
    title: "Fermentation",
    what: "Yeast eats the grape sugar and turns it into alcohol and carbon dioxide (CO₂). Most fermentations take one to three weeks, in steel tanks or wooden vats.",
    why: "Let it finish and the wine is dry; stop it early and some sugar stays behind as sweetness. More sugar at the start means more alcohol, and more body.",
    callouts: [
      { style: "red", text: "Ferments with its skins, soaking up color and tannin as it goes, and is pressed off its skins once fermentation finishes." },
      { style: "fortified", text: "For sweet styles like Port, brandy is added partway through, stopping the yeast and leaving the wine sweet and strong. Dry styles like Sherry are fortified after fermentation." },
    ],
    source: "general",
  },
  {
    id: "age",
    title: "Aging",
    what: "The new wine rests for months or years before bottling. Stainless steel tanks keep it sealed off from air; oak barrels let in a little oxygen and lend flavors of their own.",
    why: "Steel keeps a wine fresh and fruit-forward. Oak rounds it out with notes of vanilla, toast and spice, plus a touch of tannin.",
    source: "general",
  },
  {
    id: "bottle",
    title: "Blending & Bottling",
    what: "Winemakers often blend grapes or barrels to balance the final wine, then clarify it by fining and filtering, and bottle it.",
    why: "Blending is how a winemaker fine-tunes the five scales: a little more acidity here, softer tannin there.",
    callouts: [
      { style: "sparkling", text: "In the traditional (Champagne) method, a second fermentation happens inside the sealed bottle, and its CO₂ becomes the bubbles. Prosecco does the same in a pressurized tank." },
    ],
    source: "general",
  },
  {
    id: "glass",
    title: "In Your Glass",
    what: "Some wines keep improving in the bottle for years as their tannins soften; most are made to enjoy within a few years. Then it's opened, poured and served.",
    why: "Everything upstream, from the vineyard's sunshine to the barrel, ends up as what you taste.",
    link: { href: "#taste", label: "Now taste it: How to Taste" },
    source: "general",
  },
];
