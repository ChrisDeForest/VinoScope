import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountryChips } from "./CountryChips";

describe("CountryChips", () => {
  it("lists the 13 countries in order with one pressed", () => {
    render(<CountryChips selectedId="france" onSelect={vi.fn()} />);
    const chips = within(screen.getByRole("group", { name: "Wine countries" })).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "United States",
      "Italy",
      "France",
      "Germany",
      "Portugal",
      "Spain",
      "Canada",
      "Argentina",
      "Hungary",
      "Chile",
      "Australia",
      "New Zealand",
      "South Africa",
    ]);
    expect(chips.filter((chip) => chip.getAttribute("aria-pressed") === "true").map((chip) => chip.textContent)).toEqual(["France"]);
  });

  it("selects on click", async () => {
    const onSelect = vi.fn();
    render(<CountryChips selectedId={null} onSelect={onSelect} />);
    const chip = screen.getByRole("button", { name: "New Zealand" });
    await userEvent.click(chip);
    // The chip itself is passed along so focus can return to it, even where clicks don't focus buttons.
    expect(onSelect).toHaveBeenCalledWith("new-zealand", chip);
  });
});
