import type { ReactNode } from "react";

interface ChapterSectionProps {
  id: string;
  index: number;
  label: string;
  title: string;
  lead: string;
  children: ReactNode;
}

export function ChapterSection({ id, index, label, title, lead, children }: ChapterSectionProps) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-16 py-12 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">
          {String(index).padStart(2, "0")} · {label}
        </p>
        <h2 id={titleId} className="font-serif text-3xl md:text-4xl text-ink mb-4">
          {title}
        </h2>
        <p className="text-ink-muted">{lead}</p>
      </header>
      {children}
    </section>
  );
}
