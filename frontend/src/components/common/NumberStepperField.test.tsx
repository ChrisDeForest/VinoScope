import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberStepperField } from "./NumberStepperField";

function Harness({ onChange }: { onChange: (v: number | undefined) => void }) {
  const [value, setValue] = useState<number | undefined>(12);
  return <NumberStepperField id="abv" label="Min alcohol" value={value} step={0.5} suffix="%" onChange={(v) => { setValue(v); onChange(v); }} />;
}

describe("NumberStepperField", () => {
  it("steps by the given step with the themed buttons", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Increase min alcohol" }));
    expect(onChange).toHaveBeenLastCalledWith(12.5);
    await userEvent.click(screen.getByRole("button", { name: "Decrease min alcohol" }));
    expect(onChange).toHaveBeenLastCalledWith(12);
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("hides the native spinner and reports cleared input as undefined", async () => {
    const onChange = vi.fn();
    render(<NumberStepperField id="p" label="Max price" value={5} onChange={onChange} />);
    const input = screen.getByLabelText("Max price");
    expect(input).toHaveClass("stepper-input");
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
