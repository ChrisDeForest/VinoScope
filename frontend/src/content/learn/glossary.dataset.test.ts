import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { GLOSSARY_TERMS } from "./glossary";

const TYPES = new Set(DATASET_ROWS.map((row) => row.type));
const COUNTRIES = new Set(DATASET_ROWS.map((row) => row.country));

const exploreLinks = GLOSSARY_TERMS.flatMap((term) =>
  term.seeAlso?.kind === "explore" ? [[term.id, term.seeAlso.params] as const] : []
);

describe("Glossary Explore links against the dataset", () => {
  it.each(exploreLinks)("%s filters on values the catalog has", (_id, params) => {
    if (params.type) expect(TYPES.has(params.type)).toBe(true);
    if (params.country) expect(COUNTRIES.has(params.country)).toBe(true);
  });
});
