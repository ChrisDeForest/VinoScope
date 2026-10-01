import { useActiveChapter } from "../../hooks/useActiveChapter";

export interface ChapterLink {
  id: string;
  label: string;
}

export function ChapterNav({ chapters }: { chapters: readonly ChapterLink[] }) {
  // A one-item bar is noise; it appears once a second chapter ships. Until then, observe nothing.
  const visible = chapters.length >= 2;
  const active = useActiveChapter(visible ? chapters.map((chapter) => chapter.id) : []);
  if (!visible) return null;

  return (
    <nav aria-label="Learn chapters" className="sticky top-0 z-10 -mx-4 px-4 bg-surface border-b border-surface-border">
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
