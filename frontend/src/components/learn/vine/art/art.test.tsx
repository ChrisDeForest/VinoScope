import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { STAGE_ART } from ".";
import { VINE_STAGES } from "../../../../content/learn/vine";

const STAGE_IDS = VINE_STAGES.map((stage) => stage.id);

describe("STAGE_ART", () => {
  it("has art for every stage", () => {
    expect(Object.keys(STAGE_ART).sort()).toEqual([...STAGE_IDS].sort());
  });

  it.each(STAGE_IDS)("%s renders one unfocusable svg whose drawn strokes are normalized", (id) => {
    const Art = STAGE_ART[id];
    const { container } = render(<Art />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute("focusable", "false");
    const strokes = container.querySelectorAll(".draw");
    expect(strokes.length).toBeGreaterThan(0);
    for (const stroke of strokes) expect(stroke).toHaveAttribute("pathLength", "1");
  });
});
