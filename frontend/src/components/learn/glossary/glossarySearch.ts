import type { GlossaryCategory, GlossaryTerm } from "../../../content/learn/glossary";

export type CategoryFilter = GlossaryCategory | "all";

/** Case- and accent-insensitive form, so "semillon" finds "Sémillon". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function filterTerms(terms: readonly GlossaryTerm[], query: string, category: CategoryFilter): GlossaryTerm[] {
  const needle = normalize(query);
  return terms
    .filter((term) => category === "all" || term.category === category)
    .filter((term) => !needle || normalize(`${term.term} ${term.definition}`).includes(needle))
    .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
}
