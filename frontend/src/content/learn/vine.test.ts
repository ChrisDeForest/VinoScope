import { describe, it, expect } from "vitest";
import { VINE_CHAPTER, VINE_STAGES, WINE_STYLES } from "./vine";

describe("Vine to Glass content", () => {
  it("has chapter strings", () => {
    expect(VINE_CHAPTER.id).toBe("vine");
    expect(VINE_CHAPTER.label).toBe("Vine to Glass");
    expect(VINE_CHAPTER.title).toBe("From vine to glass");
    expect(VINE_CHAPTER.lead.trim()).not.toBe("");
  });

  it("has the seven stages in order", () => {
    expect(VINE_STAGES.map((stage) => stage.id)).toEqual([
      "vineyard",
      "harvest",
      "crush",
      "ferment",
      "age",
      "bottle",
      "glass",
    ]);
  });

  it.each(VINE_STAGES.map((stage) => [stage.id, stage] as const))("%s has copy and a source", (_id, stage) => {
    for (const text of [stage.title, stage.what, stage.why]) expect(text.trim()).not.toBe("");
    expect(["general", "course"]).toContain(stage.source);
  });

  it("only uses dataset wine types for callouts", () => {
    expect(WINE_STYLES).toEqual(["red", "white", "rosé", "sparkling", "fortified"]);
    for (const stage of VINE_STAGES) {
      for (const callout of stage.callouts ?? []) {
        expect(WINE_STYLES).toContain(callout.style);
        expect(callout.text.trim()).not.toBe("");
      }
    }
  });

  it("puts the style callouts where styles differ", () => {
    const styles = (id: string) => (VINE_STAGES.find((stage) => stage.id === id)?.callouts ?? []).map((c) => c.style);
    expect(styles("crush")).toEqual(["white", "rosé", "red"]);
    expect(styles("ferment")).toEqual(["red", "fortified"]);
    expect(styles("bottle")).toEqual(["sparkling"]);
  });

  it("ends by pointing back to How to Taste", () => {
    expect(VINE_STAGES[VINE_STAGES.length - 1].link).toEqual({ href: "#taste", label: "Now taste it: How to Taste" });
  });
});
