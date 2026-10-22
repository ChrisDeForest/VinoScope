import { useRef } from "react";
import { useActiveChapter } from "../../hooks/useActiveChapter";
import { trackEvent } from "../../utils/analytics";

export interface ChapterLink {
  id: string;
  label: string;
}

export function ChapterNav({ chapters }: { chapters: readonly ChapterLink[] }) {
  // A one-item bar is noise; it appears once a second chapter ships. Until then, observe nothing.
  const visible = chapters.length >= 2;
  // Each chapter counts once per visit, however often the reader scrolls back to it.
  const reported = useRef(new Set<string>());
  const active = useActiveChapter(visible ? chapters.map((chapter) => chapter.id) : [], (id) => {
    if (reported.current.has(id)) return;
    reported.current.add(id);
    const chapter = chapters.find((candidate) => candidate.id === id);
    if (chapter) trackEvent("learn_chapter_view", { chapter: chapter.label });
  });
  if (!visible) return null;

  return (
    <nav aria-label="Learn chapters" className="sticky top-14 z-10 -mx-4 px-4 bg-surface border-b border-surface-border">
      <ul className="flex gap-6 overflow-x-auto py-3 text-sm whitespace-nowrap">
        {chapters.map((chapter) => {
          const isActive = chapter.id === active;
          return (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`pb-1 border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  isActive ? "border-accent text-accent" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {chapter.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
