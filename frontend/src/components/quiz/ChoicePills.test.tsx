import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoicePills } from "./ChoicePills";

const OPTIONS = [
  { value: "red", label: "Red", swatch: "#800" },
  { value: "white", label: "White" },
];

function renderPills(selected: string[]) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  render(
    <ChoicePills legend="Pick a type" options={OPTIONS} selected={selected} onToggle={onToggle} onClear={onClear} noneLabel="No preference" />
  );
  return { onToggle, onClear };
}

describe("ChoicePills", () => {
  it("groups the pills under the question", () => {
    renderPills([]);
    expect(screen.getByRole("group", { name: "Pick a type" })).toBeInTheDocument();
  });

  it("marks the none pill pressed when nothing is selected", () => {
    renderPills([]);
    expect(screen.getByRole("button", { name: "No preference" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects the selection", () => {
    renderPills(["white"]);
    expect(screen.getByRole("button", { name: "White" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "No preference" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports toggles and clears", async () => {
    const { onToggle, onClear } = renderPills(["white"]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Red" }));
    expect(onToggle).toHaveBeenCalledWith("red");
    await user.click(screen.getByRole("button", { name: "No preference" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
