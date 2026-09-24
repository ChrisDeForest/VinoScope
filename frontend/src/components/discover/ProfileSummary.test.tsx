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

  it("renders a custom title when provided", () => {
    render(<ProfileSummary description={["Sweet"]} title="Pairing with Dessert" />);
    expect(screen.getByRole("heading", { name: "Pairing with Dessert" })).toBeInTheDocument();
  });

  it("defaults to 'Your Wine Profile' when no title is provided", () => {
    render(<ProfileSummary description={["Sweet"]} />);
    expect(screen.getByRole("heading", { name: "Your Wine Profile" })).toBeInTheDocument();
  });
});
