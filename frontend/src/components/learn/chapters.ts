import { TASTE_CHAPTER } from "../../content/learn/taste";
import { TasteChapter } from "./taste/TasteChapter";

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
];
