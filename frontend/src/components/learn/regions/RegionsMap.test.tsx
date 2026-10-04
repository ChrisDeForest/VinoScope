import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubMatchMedia } from "../../../test/stubs";
import { RegionsMap } from "./RegionsMap";
import type { MapSelection } from "./useMapSelection";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
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

  it("draws the outlines in on first reveal at world view", () => {
    renderMap(WORLD);
    const outlines = map().querySelectorAll("path.draw");
    expect(outlines.length).toBeGreaterThan(150);
    outlines.forEach((outline) => expect(outline.getAttribute("pathLength")).toBe("1"));
  });

  // The draw-in's dash is one outline long in user space, but non-scaling strokes dash in screen space,
  // so a zoomed outline would break into dashes. The dash goes once the draw-in has played.
  it("drops the draw-in dash once the outlines are drawn", () => {
    vi.useFakeTimers();
    renderMap(WORLD);
    expect(map().querySelectorAll("path.draw").length).toBeGreaterThan(150);
    act(() => vi.advanceTimersByTime(2000));
    expect(map().querySelectorAll("path.draw, [pathLength]")).toHaveLength(0);
  });

  it("never dashes an outline while zoomed, even mid draw-in", () => {
    const { view } = renderMap(WORLD);
    view.rerender(<RegionsMap selection={{ countryId: "france", regionId: null }} inset={false} onSelectCountry={vi.fn()} onSelectRegion={vi.fn()} />);
    expect(map().querySelectorAll("path.draw, [pathLength]")).toHaveLength(0);
    view.rerender(<RegionsMap selection={WORLD} inset={false} onSelectCountry={vi.fn()} onSelectRegion={vi.fn()} />);
    expect(map().querySelectorAll("path.draw, [pathLength]")).toHaveLength(0);
  });

  it("arrives zoomed from a deep link without any dash", () => {
    renderMap({ countryId: "germany", regionId: null });
    expect(map().querySelectorAll("path.draw, [pathLength]")).toHaveLength(0);
  });

  it("skips the draw-in under reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });
    renderMap(WORLD);
    expect(map().querySelectorAll("path.draw, [pathLength]")).toHaveLength(0);
  });

  it("zooms the graticule with the countries, with a hairline stroke and no draw-in", () => {
    renderMap(WORLD);
    const graticule = within(zoom()).getByTestId("graticule");
    expect(graticule).toHaveAttribute("vector-effect", "non-scaling-stroke");
    expect(graticule).not.toHaveClass("draw");
    expect(graticule).not.toHaveAttribute("pathLength");
  });

  it("keeps only the selected country in the tab order while zoomed", () => {
    const first = renderMap(WORLD);
    within(map())
      .getAllByRole("button")
      .forEach((button) => expect(button).toHaveAttribute("tabindex", "0"));
    first.view.unmount();
    renderMap({ countryId: "france", regionId: null });
    expect(within(map()).getByRole("button", { name: "France" })).toHaveAttribute("tabindex", "0");
    expect(within(map()).getByRole("button", { name: "Italy" })).toHaveAttribute("tabindex", "-1");
    expect(within(map()).getByRole("button", { name: "Bordeaux" })).toHaveAttribute("tabindex", "0");
  });

  function haloRadius(width: number): number {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: width / 2 } as DOMRect);
    const { view } = renderMap({ countryId: "france", regionId: null });
    const k = Number(/scale\(([\d.]+)\)/.exec(zoom().style.transform)![1]);
    const r = Number(within(map()).getByRole("button", { name: "Bordeaux" }).querySelector(".map-pin-halo")!.getAttribute("r"));
    view.unmount();
    vi.restoreAllMocks();
    return r * k * (width / 1200);
  }

  it("keeps pins the same size on screen whatever the map's width", () => {
    expect(haloRadius(1200)).toBeCloseTo(10);
    expect(haloRadius(390)).toBeCloseTo(10);
  });

  it("gives every pin a tap target of at least 24px", () => {
    renderMap({ countryId: "france", regionId: null });
    const k = Number(/scale\(([\d.]+)\)/.exec(zoom().style.transform)![1]);
    for (const name of ["Bordeaux", "Alsace"]) {
      const hit = within(map()).getByRole("button", { name }).querySelector(".map-pin-hit")!;
      expect(Number(hit.getAttribute("r")) * k * 2).toBeGreaterThanOrEqual(24);
    }
  });

  it("puts Mosel's label on the left so Rheingau's pin doesn't cover it", () => {
    renderMap({ countryId: "germany", regionId: null });
    const label = (name: string) => within(map()).getByRole("button", { name }).querySelector("text")!;
    expect(label("Mosel")).toHaveAttribute("text-anchor", "end");
    expect(label("Rheingau")).toHaveAttribute("text-anchor", "start");
  });
});
