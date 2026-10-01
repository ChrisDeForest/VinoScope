import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StyleCallout } from "./StyleCallout";

function renderCallout(style: Parameters<typeof StyleCallout>[0]["style"], text = "Some text.") {
  return render(
    <MemoryRouter>
      <StyleCallout style={style} text={text} />
    </MemoryRouter>
  );
}

describe("StyleCallout", () => {
  it("names the style and shows its text", () => {
    renderCallout("red", "Ferments with its skins.");
    expect(screen.getByText("Red:")).toBeInTheDocument();
    expect(screen.getByText(/Ferments with its skins\./)).toBeInTheDocument();
  });

  it("links to Explore filtered by the style", () => {
    renderCallout("red");
    expect(screen.getByRole("link", { name: "Explore red wines →" })).toHaveAttribute("href", "/explore?type=red");
  });

  it("encodes accented styles in the link", () => {
    renderCallout("rosé");
    expect(screen.getByText("Rosé:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore rosé wines →" })).toHaveAttribute("href", "/explore?type=ros%C3%A9");
  });
});
