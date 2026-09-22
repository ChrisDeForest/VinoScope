import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSummary } from "./ProfileSummary";

describe("ProfileSummary", () => {
  it("renders each description line", () => {
    render(<ProfileSummary description={["Very dry", "Full-bodied"]} />);
    expect(screen.getByText("Very dry")).toBeInTheDocument();
    expect(screen.getByText("Full-bodied")).toBeInTheDocument();
  });

  it("shows a fallback message when description is empty", () => {
    render(<ProfileSummary description={[]} />);
    expect(screen.getByText(/no specific preferences set/i)).toBeInTheDocument();
  });
});
