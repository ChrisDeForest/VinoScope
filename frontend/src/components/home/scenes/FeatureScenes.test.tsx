import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ComponentType } from "react";
import { DiscoverScene } from "./DiscoverScene";
import { PairScene } from "./PairScene";
import { CompareScene } from "./CompareScene";
import { LearnScene } from "./LearnScene";

const CASES: { name: string; Component: ComponentType; title: string; cta: string; href: string; side: string }[] = [
  { name: "Discover", Component: DiscoverScene, title: "Find your wine profile.", cta: "Find Your Profile", href: "/discover", side: "right" },
  { name: "Pair", Component: PairScene, title: "Match the bottle to the plate.", cta: "Pair With Food", href: "/pair", side: "left" },
  { name: "Compare", Component: CompareScene, title: "Taste two wines side by side.", cta: "Compare Wines", href: "/compare", side: "right" },
  { name: "Learn", Component: LearnScene, title: "Learn what's in your glass.", cta: "Start Learning", href: "/learn", side: "left" },
];

function renderScene(Component: ComponentType) {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  );
}

describe.each(CASES)("$name scene", ({ Component, title, cta, href, side }) => {
  it("renders its heading, CTA, side, and hidden art", () => {
    renderScene(Component);
    const section = screen.getByRole("region", { name: title });
    expect(section).toHaveAttribute("data-side", side);
    expect(screen.getByRole("link", { name: cta })).toHaveAttribute("href", href);
    expect(screen.getByTestId("scene-art").querySelector("svg")).not.toBeNull();
  });
});

describe("DiscoverScene", () => {
  it("shows the five taste dimensions with their sample values", () => {
    renderScene(DiscoverScene);
    for (const [label, percent] of [
      ["Body", "70%"],
      ["Tannin", "55%"],
      ["Acidity", "60%"],
      ["Sweetness", "20%"],
      ["Fruitiness", "65%"],
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(percent)).toBeInTheDocument();
    }
  });
});

describe("PairScene", () => {
  it("shows food chips from the shared pairing labels", () => {
    renderScene(PairScene);
    expect(screen.getByText("Steak")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
    expect(screen.getByText("Aged cheese")).toBeInTheDocument();
  });
});

describe("LearnScene", () => {
  it("sets expectations that the guide is still coming", () => {
    renderScene(LearnScene);
    expect(screen.getByText(/the Learn guide is being poured now/i)).toBeInTheDocument();
  });
});
