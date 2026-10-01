import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DIMENSION_ART } from ".";
import { DIMENSIONS } from "../../../../utils/dimensionLabels";

describe("DIMENSION_ART", () => {
  it("has art for every dimension", () => {
    expect(Object.keys(DIMENSION_ART).sort()).toEqual([...DIMENSIONS].sort());
  });

  it.each([...DIMENSIONS])("%s renders one unfocusable svg with drawn strokes", (dimension) => {
    const Art = DIMENSION_ART[dimension];
    const { container } = render(<Art />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute("focusable", "false");
    expect(container.querySelectorAll(".draw").length).toBeGreaterThan(0);
    for (const stroke of container.querySelectorAll(".draw")) {
      expect(stroke).toHaveAttribute("pathLength", "1");
    }
  });
});
