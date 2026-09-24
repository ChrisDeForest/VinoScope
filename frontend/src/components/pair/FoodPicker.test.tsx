import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FoodPicker } from "./FoodPicker";
import { FOOD_OPTIONS, FOOD_PAIRINGS } from "../../constants/foodPairings";

describe("FoodPicker", () => {
  it("renders one tile per food with its label and blurb", () => {
    render(<FoodPicker onSelect={() => {}} />);
    for (const food of FOOD_OPTIONS) {
      const { label, blurb } = FOOD_PAIRINGS[food];
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(blurb)).toBeInTheDocument();
    }
  });

  it("calls onSelect with the right food key when a tile is clicked", async () => {
    const onSelect = vi.fn();
    render(<FoodPicker onSelect={onSelect} />);
    const user = userEvent.setup();
    await user.click(screen.getByText(FOOD_PAIRINGS.steak.label));
    expect(onSelect).toHaveBeenCalledWith("steak");
  });

  it("disables every tile when loading is true", () => {
    render(<FoodPicker onSelect={() => {}} loading />);
    for (const food of FOOD_OPTIONS) {
      const tile = screen.getByText(FOOD_PAIRINGS[food].label).closest("button");
      expect(tile).toBeDisabled();
    }
  });
});
