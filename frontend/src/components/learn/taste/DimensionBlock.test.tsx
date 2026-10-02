import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DimensionBlock } from "./DimensionBlock";
import { TASTE_DIMENSIONS } from "../../../content/learn/taste";
import type { WineListItem } from "../../../types/wine";
import type { PairState } from "./pairs";

const TANNIN = TASTE_DIMENSIONS.find((entry) => entry.dimension === "tannin")!;

function wine(id: number, name: string, tannin: number): WineListItem {
  return {
    id,
    name,
    winery: "W",
    vintage: 2020,
    type: "red",
    country: "Italy",
    region: null,
    grapes: [],
    price: null,
    currency: null,
    price_usd_approx: null,
    image_url: null,
    sweetness: 1,
    acidity: 3,
    tannin,
    body: 3,
    fruitiness: 3,
  };
}

function renderBlock(pair: PairState, side: "left" | "right" = "left") {
  return render(
    <MemoryRouter>
      <DimensionBlock content={TANNIN} pair={pair} side={side} />
    </MemoryRouter>
  );
}

describe("DimensionBlock", () => {
  it("renders the heading, copy, and hidden art", () => {
    renderBlock({ status: "hidden" });
    const article = screen.getByRole("article", { name: "Tannin" });
    expect(within(article).getByRole("heading", { level: 3, name: "Tannin" })).toBeInTheDocument();
    expect(within(article).getByRole("heading", { level: 3, name: "Tannin" })).toHaveClass("scroll-mt-24");
    expect(article).toHaveTextContent(TANNIN.what);
    expect(article).toHaveTextContent(TANNIN.feel);
    expect(article).toHaveTextContent(TANNIN.tip);
    expect(screen.getByTestId("dimension-art")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows skeletons while the pair loads", () => {
    renderBlock({ status: "loading" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("shows both wines with links, real scores, and scale markers when ready", () => {
    renderBlock({ status: "ready", low: wine(3, "Light Red", 2), high: wine(4, "Big Red", 5) });
    const examples = screen.getByRole("list", { name: "Example wines" });
    const links = within(examples).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/wines/3");
    expect(links[0]).toHaveTextContent("Tannin 2 / 5");
    expect(links[0]).toHaveTextContent(TANNIN.low.reason);
    expect(links[1]).toHaveAttribute("href", "/wines/4");
    expect(links[1]).toHaveTextContent("Tannin 5 / 5");
    const scale = screen.getByRole("list", { name: "Tannin scale, 1 to 5" });
    expect(scale).toHaveTextContent("Example: Light Red");
    expect(scale).toHaveTextContent("Example: Big Red");
  });

  it("drops the pair but keeps the scale when hidden", () => {
    renderBlock({ status: "hidden" });
    expect(screen.queryByRole("list", { name: "Example wines" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Tannin scale, 1 to 5" })).not.toHaveTextContent("Example:");
  });

  it("moves the art to the right column only for right-side blocks", () => {
    const { unmount } = renderBlock({ status: "hidden" }, "right");
    expect(screen.getByTestId("dimension-art")).toHaveClass("md:order-last");
    unmount();
    renderBlock({ status: "hidden" }, "left");
    expect(screen.getByTestId("dimension-art")).not.toHaveClass("md:order-last");
  });

  it.each([
    ["loading", { status: "loading" } as PairState],
    ["ready", { status: "ready", low: wine(3, "Light Red", 2), high: wine(4, "Big Red", 5) } as PairState],
    ["hidden", { status: "hidden" } as PairState],
  ])("reserves the same pair-area height while %s", (_label, pair) => {
    renderBlock(pair);
    const area = screen.getByTestId("pair-area");
    expect(area).toHaveClass("min-h-[18rem]");
    expect(area).toHaveClass("sm:min-h-[9.5rem]");
  });
});
