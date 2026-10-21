import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SpilledGlass } from "../components/notfound/SpilledGlass";
import { usePageMeta } from "../hooks/usePageMeta";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const COPY = {
  page: {
    title: "Page not found · VinoScope",
    eyebrow: "404 · Page not found",
    heading: "Well, that spilled.",
    text: "We couldn't find that page. Try searching the cellar instead:",
  },
  wine: {
    title: "Wine not found · VinoScope",
    eyebrow: "404 · Wine not found",
    heading: "That wine isn't in our cellar.",
    text: "It may have been removed, or the link is off by a vintage. Try searching instead:",
  },
} as const;

export function NotFoundPage({ variant = "page" }: { variant?: "page" | "wine" }) {
  const copy = COPY[variant];
  usePageMeta({ title: copy.title, noindex: true });
  const reducedMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/explore?${new URLSearchParams({ q })}` : "/explore");
  }

  return (
    <div className="flex flex-col items-center text-center py-8 gap-4">
      <SpilledGlass animate={!reducedMotion} />
      <p className="text-xs uppercase tracking-[0.25em] text-accent">{copy.eyebrow}</p>
      <h1 className="font-serif text-3xl md:text-4xl text-ink">{copy.heading}</h1>
      <p className="text-ink-muted max-w-md">{copy.text}</p>
      <form role="search" onSubmit={search} className="flex w-full max-w-md gap-2">
        <input
          type="search"
          aria-label="Search wines"
          placeholder="Search wines, grapes, regions…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 rounded border border-surface-border bg-surface-raised px-3 py-2 text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Search
        </button>
      </form>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/explore" className="rounded border border-surface-border px-4 py-2 text-ink hover:border-accent">
          Explore all wines
        </Link>
        <Link to="/" className="rounded border border-surface-border px-4 py-2 text-ink hover:border-accent">
          Back home
        </Link>
      </div>
    </div>
  );
}
