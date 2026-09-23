import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DimensionField } from "./DimensionField";

describe("DimensionField", () => {
  it("renders all 5 levels plus an 'I'm unsure' option", () => {
    render(<DimensionField dimension="sweetness" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Very dry")).toBeInTheDocument();
    expect(screen.getByLabelText("Very sweet")).toBeInTheDocument();
    expect(screen.getByLabelText("I'm unsure")).toBeInTheDocument();
  });

  it("defaults to 'I'm unsure' selected when value is undefined", () => {
    render(<DimensionField dimension="sweetness" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByLabelText("I'm unsure")).toBeChecked();
  });

  it("calls onChange with the level when a level is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionField dimension="tannin" value={undefined} onChange={onChange} />);
    await user.click(screen.getByLabelText("High tannin"));
    expect(onChange).toHaveBeenCalledWith([5]);
  });

  it("calls onChange with undefined when 'I'm unsure' is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionField dimension="tannin" value={5} onChange={onChange} />);
    await user.click(screen.getByLabelText("I'm unsure"));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
