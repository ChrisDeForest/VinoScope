import { TASTE_CHAPTER } from "../../content/learn/taste";
import { VINE_CHAPTER } from "../../content/learn/vine";
import { GRAPES_CHAPTER } from "../../content/learn/grapes";
import { TasteChapter } from "./taste/TasteChapter";
import { VineChapter } from "./vine/VineChapter";
import { GrapesChapter } from "./grapes/GrapesChapter";

export interface LearnChapter {
  id: string;
  label: string;
  title: string;
  lead: string;
  Component: () => JSX.Element;
}

// Drives both the chapter nav and the page sections. Add later parts here, in reading order.
export const LEARN_CHAPTERS: readonly LearnChapter[] = [
  {
    id: TASTE_CHAPTER.id,
    label: TASTE_CHAPTER.label,
    title: TASTE_CHAPTER.title,
    lead: TASTE_CHAPTER.lead,
    Component: TasteChapter,
  },
  {
    id: VINE_CHAPTER.id,
    label: VINE_CHAPTER.label,
    title: VINE_CHAPTER.title,
    lead: VINE_CHAPTER.lead,
    Component: VineChapter,
  },
  {
    id: GRAPES_CHAPTER.id,
    label: GRAPES_CHAPTER.label,
    title: GRAPES_CHAPTER.title,
    lead: GRAPES_CHAPTER.lead,
    Component: GrapesChapter,
  },
];
