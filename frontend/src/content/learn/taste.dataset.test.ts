import { describe, it, expect } from "vitest";
import csvText from "../../../../data/cleaned/wines_combined_200_currency_audited.csv?raw";
import { TASTE_DIMENSIONS, type WinePick } from "./taste";

// Minimal RFC 4180 parser: quoted fields may contain commas, newlines, and "" escapes.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => Object.fromEntries(header.map((name, j) => [name, cells[j].trim()])));
}

const rows = parseCsv(csvText);

function findRow(pick: WinePick) {
  const vintage = pick.vintage === null ? "" : String(pick.vintage);
  return rows.find((row) => row.winery === pick.winery && row.name === pick.name && row.vintage === vintage);
}

describe("How to Taste picks against the dataset", () => {
  it("parsed the dataset", () => {
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });

  it.each(TASTE_DIMENSIONS.map((entry) => [entry.dimension, entry] as const))(
    "%s: both picks exist and high beats low by at least 2",
    (dimension, entry) => {
      const low = findRow(entry.low);
      const high = findRow(entry.high);
      expect(low, `low pick not found: ${entry.low.name}`).toBeDefined();
      expect(high, `high pick not found: ${entry.high.name}`).toBeDefined();
      expect(Number(high![dimension]) - Number(low![dimension])).toBeGreaterThanOrEqual(2);
    }
  );
});
