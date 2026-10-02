import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GLOSSARY_TERMS } from "../../../content/learn/glossary";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { GlossaryControls } from "./GlossaryControls";
import { filterTerms, type CategoryFilter } from "./glossarySearch";
import { TermCard, termCardId, termHeadingId } from "./TermCard";

const FLASH_MS = 1500;

// A fresh object per jump, so jumping to the same term twice still re-runs the effects.
type Jump = { id: string };

function countLabel(n: number): string {
  if (n === 0) return "No terms match";
  return n === 1 ? "1 term" : `${n} terms`;
}

export function GlossaryChapter() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [pendingJump, setPendingJump] = useState<Jump | null>(null);
  const [flash, setFlash] = useState<Jump | null>(null);
  const visible = useMemo(() => filterTerms(GLOSSARY_TERMS, query, category), [query, category]);

  function clearFilters() {
    setQuery("");
    setCategory("all");
  }

  function jump(id: string) {
    if (!visible.some((term) => term.id === id)) clearFilters();
    // Replace, like the grape picker, so hopping between terms doesn't fill the back button.
    navigate({ pathname: location.pathname, search: location.search, hash: `#${termCardId(id)}` }, { replace: true });
    setPendingJump({ id });
  }

  // Runs after the render that un-hid the target, so the card exists to scroll to.
  useEffect(() => {
    if (!pendingJump) return;
    document.getElementById(termCardId(pendingJump.id))?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    document.getElementById(termHeadingId(pendingJump.id))?.focus({ preventScroll: true });
    setFlash(pendingJump);
    setPendingJump(null);
  }, [pendingJump, reducedMotion]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return (
    <div className="mt-8">
      <GlossaryControls query={query} onQueryChange={setQuery} category={category} onCategoryChange={setCategory} />
      <p role="status" className="mt-4 text-sm text-ink-muted">
        {countLabel(visible.length)}
      </p>
      {visible.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {visible.map((term) => (
            <TermCard key={term.id} term={term} flash={flash?.id === term.id} onJump={jump} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded border border-surface-border bg-surface-raised p-6 text-center">
          <p className="text-ink">No terms match “{query.trim()}”.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
