import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubMatchMedia } from "../../../test/stubs";
import { RegionsMap } from "./RegionsMap";
import type { MapSelection } from "./useMapSelection";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderMap(selection: MapSelection, inset = false) {
  const onSelectCountry = vi.fn();
  const onSelectRegion = vi.fn();
  const view = render(<RegionsMap selection={selection} inset={inset} onSelectCountry={onSelectCountry} onSelectRegion={onSelectRegion} />);
  return { onSelectCountry, onSelectRegion, view };
}

const map = () => screen.getByRole("group", { name: "World wine map" });
const zoom = () => screen.getByTestId("map-zoom");
const WORLD: MapSelection = { countryId: null, regionId: null };

describe("RegionsMap", () => {
  it("offers the 13 wine countries as buttons and nothing else at world view", () => {
    renderMap(WORLD);
    const buttons = within(map()).getAllByRole("button");
    expect(buttons).toHaveLength(13);
    expect(within(map()).getByRole("button", { name: "United States" })).toHaveAttribute("aria-pressed", "false");
    expect(zoom().style.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("selects a country by click, Enter or Space", async () => {
    const { onSelectCountry } = renderMap(WORLD);
    await userEvent.click(within(map()).getByRole("button", { name: "France" }));
    expect(onSelectCountry).toHaveBeenLastCalledWith("france");
    fireEvent.keyDown(within(map()).getByRole("button", { name: "Italy" }), { key: "Enter" });
    expect(onSelectCountry).toHaveBeenLastCalledWith("italy");
    fireEvent.keyDown(within(map()).getByRole("button", { name: "Spain" }), { key: " " });
    expect(onSelectCountry).toHaveBeenLastCalledWith("spain");
  });

  it("zooms to the selected country and shows its pins", async () => {
    const { onSelectRegion } = renderMap({ countryId: "france", regionId: null });
    expect(within(map()).getByRole("button", { name: "France" })).toHaveAttribute("aria-pressed", "true");
    expect(zoom().style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/);
    expect(zoom().style.transform).not.toContain("scale(1)");
    for (const name of ["Bordeaux", "Burgundy", "Champagne", "Rhône", "Loire", "Alsace", "Provence"]) {
      expect(within(map()).getByRole("button", { name })).toBeInTheDocument();
    }
    await userEvent.click(within(map()).getByRole("button", { name: "Bordeaux" }));
    expect(onSelectRegion).toHaveBeenCalledWith("bordeaux");
  });

  it("marks the selected region's pin", () => {
    renderMap({ countryId: "france", regionId: "champagne" });
    expect(within(map()).getByRole("button", { name: "Champagne" })).toHaveAttribute("aria-pressed", "true");
    expect(within(map()).getByRole("button", { name: "Bordeaux" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shifts left to make room for the drawer when inset", () => {
    const wide = renderMap({ countryId: "france", regionId: null }, false);
    const full = zoom().style.transform;
    wide.view.unmount();
    renderMap({ countryId: "france", regionId: null }, true);
    expect(zoom().style.transform).not.toBe(full);
  });

  it("draws state lines only for the United States", () => {
    const first = renderMap({ countryId: "france", regionId: null });
    expect(screen.queryByTestId("us-states")).not.toBeInTheDocument();
    first.view.unmount();
    renderMap({ countryId: "united-states", regionId: null });
    expect(screen.getByTestId("us-states")).toBeInTheDocument();
  });

  it("glides between views, except under reduced motion", () => {
    stubMatchMedia({ reducedMotion: false });
    const first = renderMap(WORLD);
    expect(zoom()).toHaveClass("map-zoom-animate");
    first.view.unmount();
    stubMatchMedia({ reducedMotion: true });
    renderMap(WORLD);
    expect(zoom()).not.toHaveClass("map-zoom-animate");
  });

  it("gives every outline a normalized path length for the draw-in", () => {
    renderMap(WORLD);
    const outlines = map().querySelectorAll("path.draw");
    expect(outlines.length).toBeGreaterThan(150);
    outlines.forEach((outline) => expect(outline.getAttribute("pathLength")).toBe("1"));
  });
});
