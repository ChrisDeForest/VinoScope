import { describe, it, expect } from "vitest";
import { describeTasteRange, formatTasteRange, parseTasteRange } from "./tasteRange";

describe("taste ranges", () => {
  it("parses single levels and ranges", () => {
    expect(parseTasteRange("3")).toEqual([3, 3]);
    expect(parseTasteRange("2-4")).toEqual([2, 4]);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "0", "6", "4-2", "2-", "a", "1-2-3", " 2"]) expect(parseTasteRange(bad)).toBeNull();
  });

  it("formats in either tap order and collapses one level", () => {
    expect(formatTasteRange(4, 2)).toBe("2-4");
    expect(formatTasteRange(3, 3)).toBe("3");
  });

  it("describes with short level labels", () => {
    expect(describeTasteRange("sweetness", "2-4")).toBe("Dry – Sweet");
    expect(describeTasteRange("acidity", "5")).toBe("High");
    expect(describeTasteRange("fruitiness", "1-2")).toBe("Subtle – Light");
  });
});
