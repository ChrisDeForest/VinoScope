import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { GLOSSARY_CATEGORY_LABELS, termById, type GlossaryTerm } from "../../../content/learn/glossary";

export function termCardId(id: string): string {
  return `term-${id}`;
}

export function termHeadingId(id: string): string {
  return `term-${id}-title`;
}

// Built by hand so spaces encode as %20, matching the rest of the Learn links.
export function exploreHref(params: { type?: string; country?: string }): string {
  const query = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join("&");
  return `/explore?${query}`;
}

const LINK_CLASS =
  "text-sm text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

interface TermCardProps {
  term: GlossaryTerm;
  flash: boolean;
  onJump: (id: string) => void;
}

export function TermCard({ term, flash, onJump }: TermCardProps) {
  const headingId = termHeadingId(term.id);
  const related = (term.related ?? []).flatMap((id) => {
    const target = termById(id);
    return target ? [target] : [];
  });
  const { seeAlso } = term;

  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    // Modified clicks keep their browser meaning (new tab, new window); a plain click jumps in place.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onJump(id);
  }

  return (
    <article
      id={termCardId(term.id)}
      aria-labelledby={headingId}
      className={`scroll-mt-24 rounded border border-surface-border bg-surface-raised p-5 ${flash ? "term-flash" : ""}`}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{GLOSSARY_CATEGORY_LABELS[term.category]}</p>
      <h3 id={headingId} tabIndex={-1} className="mt-1 font-serif text-xl text-ink focus:outline-none">
        {term.term}
      </h3>
      <p className="mt-2 text-ink">{term.definition}</p>
      {seeAlso ? (
        <p className="mt-3">
          {seeAlso.kind === "learn" ? (
            <a href={`#${seeAlso.anchor}`} className={LINK_CLASS}>
              {seeAlso.label} <span aria-hidden="true">→</span>
            </a>
          ) : (
            <Link to={exploreHref(seeAlso.params)} className={LINK_CLASS}>
              {seeAlso.label} <span aria-hidden="true">→</span>
            </Link>
          )}
        </p>
      ) : null}
      {related.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span>Related:</span>
          {related.map((target) => (
            <a
              key={target.id}
              href={`#${termCardId(target.id)}`}
              onClick={(event) => jump(event, target.id)}
              className="rounded-full border border-surface-border px-2.5 py-1 text-xs text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {target.term}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
