import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProfileBars } from "./ProfileBars";

const PROFILE = { sweetness: [1, 5] as const, acidity: 5, tannin: 1, body: 4, fruitiness: 3 };

function states(row: HTMLElement) {
  return within(row)
    .getAllByTestId("segment")
    .map((segment) => segment.dataset.state);
}

describe("ProfileBars", () => {
  it("renders the five scales in order with readable text", () => {
    render(<ProfileBars profile={PROFILE} />);
    const rows = within(screen.getByRole("list", { name: "Taste profile" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Sweetness: ranges from Very dry to Very sweet"),
      expect.stringContaining("Acidity: High acidity, 5 of 5"),
      expect.stringContaining("Tannin: Low tannin, 1 of 5"),
      expect.stringContaining("Body: Full-bodied, 4 of 5"),
      expect.stringContaining("Fruit Intensity: Moderate fruit, 3 of 5"),
    ]);
  });

  it("fills a single score up to its value", () => {
    render(<ProfileBars profile={PROFILE} />);
    const body = screen.getAllByRole("listitem")[3];
    expect(states(body)).toEqual(["filled", "filled", "filled", "filled", "empty"]);
  });

  it("marks a range across its span", () => {
    render(<ProfileBars profile={{ ...PROFILE, sweetness: [2, 4] }} />);
    const sweetness = screen.getAllByRole("listitem")[0];
    expect(states(sweetness)).toEqual(["empty", "range", "range", "range", "empty"]);
  });

  it("shows a visible, aria-hidden cue on ranged rows only", () => {
    render(<ProfileBars profile={PROFILE} />);
    const cues = screen.getAllByText("varies");
    expect(cues).toHaveLength(1);
    expect(cues[0].closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getAllByRole("listitem")[0]).toContainElement(cues[0]);
  });

  it("hides the segments from assistive technology", () => {
    render(<ProfileBars profile={PROFILE} />);
    for (const segment of screen.getAllByTestId("segment")) {
      expect(segment.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });
});
