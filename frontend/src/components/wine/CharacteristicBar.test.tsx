import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacteristicBar } from "./CharacteristicBar";

describe("CharacteristicBar", () => {
  it("renders the label and value out of 5", () => {
    render(<CharacteristicBar label="Tannin" value={4} />);
    expect(screen.getByText("Tannin")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("renders 'Not rated' when value is null", () => {
    render(<CharacteristicBar label="Acidity" value={null} />);
    expect(screen.getByText("Not rated")).toBeInTheDocument();
  });
});
