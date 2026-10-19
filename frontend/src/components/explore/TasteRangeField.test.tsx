import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TasteRangeField } from "./TasteRangeField";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TasteRangeField dimension="sweetness" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue("")}>External clear</button>
    </>
  );
}

const group = () => screen.getByRole("group", { name: "Sweetness" });
const level = (name: string) => within(group()).getByRole("button", { name });
const value = () => screen.getByTestId("value").textContent;

describe("TasteRangeField", () => {
  it("picks a range from two taps in either order", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(level("Sweet"));
    expect(value()).toBe("4");
    await user.click(level("Dry"));
    expect(value()).toBe("2-4");
    for (const name of ["Dry", "Off-dry", "Sweet"]) expect(level(name)).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Very dry", "Very sweet"]) expect(level(name)).toHaveAttribute("aria-pressed", "false");
  });

  it("tapping one level twice keeps just that level", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(level("Off-dry"));
    await user.click(level("Off-dry"));
    expect(value()).toBe("3");
  });

  it("a tap after a finished range starts a new one", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2-4" />);
    await user.click(level("Very dry"));
    expect(value()).toBe("1");
  });

  it("Any clears the dimension", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2-4" />);
    await user.click(within(group()).getByRole("button", { name: "Any sweetness" }));
    expect(value()).toBe("");
  });

  it("forgets a half-picked range when the value is reset elsewhere", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(level("Dry"));
    await user.click(screen.getByRole("button", { name: "External clear" }));
    await user.click(level("Very sweet"));
    expect(value()).toBe("5");
  });
});
