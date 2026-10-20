import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FoodCardGrid } from "./FoodCardGrid";
import { FOOD_OPTIONS, FOOD_PAIRINGS } from "../../constants/foodPairings";

describe("FoodCardGrid", () => {
  it("shows a photo card for every food", () => {
    render(<FoodCardGrid selected={null} onSelect={() => {}} />);
    for (const food of FOOD_OPTIONS) {
      expect(screen.getByRole("button", { name: FOOD_PAIRINGS[food].label })).toHaveAttribute("aria-pressed", "false");
    }
    expect(document.querySelector('img[src="/foods/steak.webp"]')).not.toBeNull();
  });

  it("marks the selected food and shows its pairing note", () => {
    render(<FoodCardGrid selected="salmon" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Salmon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(FOOD_PAIRINGS.salmon.blurb)).toBeInTheDocument();
  });

  it("reports a pick and can be disabled", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<FoodCardGrid selected={null} onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Pizza" }));
    expect(onSelect).toHaveBeenCalledWith("pizza");
    rerender(<FoodCardGrid selected={null} onSelect={onSelect} disabled />);
    expect(screen.getByRole("button", { name: "Pizza" })).toBeDisabled();
  });
});
