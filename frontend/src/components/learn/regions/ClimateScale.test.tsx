import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClimateScale } from "./ClimateScale";

describe("ClimateScale", () => {
  it("announces the climate and marks one of five steps", () => {
    const { container } = render(<ClimateScale value={2} label="Cool, continental" />);
    expect(screen.getByText("Climate: Cool, continental, 2 of 5 from cool to hot")).toHaveClass("sr-only");
    const steps = container.querySelectorAll("[data-step]");
    expect(steps).toHaveLength(5);
    expect(Array.from(steps).map((step) => step.hasAttribute("data-active"))).toEqual([false, true, false, false, false]);
  });
});
