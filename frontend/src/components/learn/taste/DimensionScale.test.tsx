import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DimensionScale } from "./DimensionScale";
import { DIMENSION_LABELS } from "../../../utils/dimensionLabels";

describe("DimensionScale", () => {
  it("lists the five Discover labels in order", () => {
    render(<DimensionScale dimension="tannin" markers={[]} />);
    const list = screen.getByRole("list", { name: "Tannin scale, 1 to 5" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(
      [1, 2, 3, 4, 5].map((step) => expect.stringContaining(DIMENSION_LABELS.tannin[step]))
    );
  });

  it("marks example wines at their scores", () => {
    render(
      <DimensionScale
        dimension="tannin"
        markers={[
          { score: 2, name: "Light Red", tone: "low" },
          { score: 5, name: "Big Red", tone: "high" },
        ]}
      />
    );
    const items = within(screen.getByRole("list", { name: "Tannin scale, 1 to 5" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Example: Light Red");
    expect(items[4]).toHaveTextContent("Example: Big Red");
    expect(items[0]).not.toHaveTextContent("Example:");
  });
});
