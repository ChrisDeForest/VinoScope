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

/** Checks the id and, by identity, the element passed as the opener (Vitest's DOM equality trips on SVG elements). */
function expectLastCall(mock: ReturnType<typeof vi.fn>, id: string, opener: Element) {
  const [calledId, calledOpener] = mock.mock.calls[mock.mock.calls.length - 1];
  expect(calledId).toBe(id);
  expect(calledOpener === opener).toBe(true);
}

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
    const france = within(map()).getByRole("button", { name: "France" });
    await userEvent.click(france);
    expectLastCall(onSelectCountry, "france", france);
    fireEvent.keyDown(within(map()).getByRole("button", { name: "Italy" }), { key: "Enter" });
    expectLastCall(onSelectCountry, "italy", within(map()).getByRole("button", { name: "Italy" }));
    fireEvent.keyDown(within(map()).getByRole("button", { name: "Spain" }), { key: " " });
    expectLastCall(onSelectCountry, "spain", within(map()).getByRole("button", { name: "Spain" }));
  });

  it("zooms to the selected country and shows its pins", async () => {
    const { onSelectRegion } = renderMap({ countryId: "france", regionId: null });
    expect(within(map()).getByRole("button", { name: "France" })).toHaveAttribute("aria-pressed", "true");
    expect(zoom().style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/);
    expect(zoom().style.transform).not.toContain("scale(1)");
    for (const name of ["Bordeaux", "Burgundy", "Champagne", "Rhône", "Loire", "Alsace", "Provence"]) {
      expect(within(map()).getByRole("button", { name })).toBeInTheDocument();
    }
    const bordeaux = within(map()).getByRole("button", { name: "Bordeaux" });
    await userEvent.click(bordeaux);
    expectLastCall(onSelectRegion, "bordeaux", bordeaux);
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

  /** Replaces requestAnimationFrame with one the test steps by hand, `ms` of animation at a time. */
  function stubFrames() {
    let now = 0;
    let pending: FrameRequestCallback[] = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => pending.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {
      pending = [];
    });
    return (ms: number) =>
      act(() => {
        now += ms;
        const due = pending;
        pending = [];
        due.forEach((callback) => callback(now));
      });
  }
  const scale = () => Number(/scale\(([\d.]+)\)/.exec(zoom().style.transform)![1]);
  const haloOnScreen = (name: string) =>
    Number(within(map()).getByRole("button", { name }).querySelector(".map-pin-halo")!.getAttribute("r")) * scale();

  it("glides between views, keeping pins the same size on screen the whole way", () => {
    stubMatchMedia({ reducedMotion: false });
    const advance = stubFrames();
    const { view } = renderMap({ countryId: "france", regionId: null });
    const fitted = scale();
    view.rerender(<RegionsMap selection={{ countryId: "italy", regionId: null }} inset={false} onSelectCountry={vi.fn()} onSelectRegion={vi.fn()} />);
    advance(300);
    const midway = scale();
    expect(midway).not.toBe(fitted);
    expect(haloOnScreen("Tuscany")).toBeCloseTo(10);
    advance(2000);
    expect(scale()).not.toBe(midway);
    expect(haloOnScreen("Tuscany")).toBeCloseTo(10);
  });

  it("jumps between views under reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });
    stubFrames();
    const { view } = renderMap(WORLD);
    view.rerender(<RegionsMap selection={{ countryId: "italy", regionId: null }} inset={false} onSelectCountry={vi.fn()} onSelectRegion={vi.fn()} />);
    expect(scale()).toBeGreaterThan(1);
  });

  it("zooms past the fitted view with the zoom buttons and fits again", async () => {
    stubMatchMedia({ reducedMotion: true });
    const user = userEvent.setup();
    renderMap({ countryId: "hungary", regionId: null });
    const fitted = scale();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fit Hungary" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(scale()).toBeCloseTo(fitted * 1.6);
    expect(haloOnScreen("Tokaj")).toBeCloseTo(10);
    await user.click(screen.getByRole("button", { name: `Fit Hungary` }));
    expect(scale()).toBeCloseTo(fitted);
  });

  it("stops zooming in at the ceiling", async () => {
    stubMatchMedia({ reducedMotion: true });
    const user = userEvent.setup();
    renderMap({ countryId: "hungary", regionId: null });
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    for (let i = 0; i < 10 && !(zoomIn as HTMLButtonElement).disabled; i++) await user.click(zoomIn);
    expect(zoomIn).toBeDisabled();
    expect(scale()).toBeCloseTo(96);
  });

  it("zooms small countries in much further than before", () => {
    renderMap({ countryId: "hungary", regionId: null });
    expect(scale()).toBeGreaterThan(12);
  });

  it("offers no zoom buttons at world view", () => {
    renderMap(WORLD);
    expect(screen.queryByRole("group", { name: "Map zoom" })).not.toBeInTheDocument();
  });

  it("pans by dragging once zoomed in, without selecting what the drag started on", async () => {
    stubMatchMedia({ reducedMotion: true });
    const user = userEvent.setup();
    const { onSelectRegion } = renderMap({ countryId: "france", regionId: null });
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    const before = zoom().style.transform;
    const pin = within(map()).getByRole("button", { name: "Bordeaux" });
    fireEvent.pointerDown(pin, { clientX: 100, clientY: 100, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(pin, { clientX: 160, clientY: 130, pointerType: "mouse" });
    fireEvent.pointerUp(pin, { clientX: 160, clientY: 130, pointerType: "mouse" });
    fireEvent.click(pin);
    expect(zoom().style.transform).not.toBe(before);
    expect(onSelectRegion).not.toHaveBeenCalled();
    fireEvent.click(pin);
    expectLastCall(onSelectRegion, "bordeaux", pin);
  });

  it("doesn't pan at the fitted view", () => {
    renderMap({ countryId: "france", regionId: null });
    const before = zoom().style.transform;
    fireEvent.pointerDown(map(), { clientX: 100, clientY: 100, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(map(), { clientX: 200, clientY: 200, pointerType: "mouse" });
    fireEvent.pointerUp(map());
    expect(zoom().style.transform).toBe(before);
  });

  it("never lets neighboring pins' tap targets overlap", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 358, height: 179 } as DOMRect);
    renderMap({ countryId: "chile", regionId: null });
    const k = scale();
    const circles = within(map())
      .getAllByRole("button")
      .flatMap((button) => Array.from(button.querySelectorAll(".map-pin-hit")))
      .map((hit) => ({ x: Number(hit.getAttribute("cx")), y: Number(hit.getAttribute("cy")), r: Number(hit.getAttribute("r")) }));
    expect(circles.length).toBeGreaterThan(2);
    for (const a of circles)
      for (const b of circles) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y) * k).toBeGreaterThanOrEqual((a.r + b.r) * k - 1e-6);
      }
  });

  it("lets a phone reader zoom in until every Italian region is labeled", async () => {
    stubMatchMedia({ reducedMotion: true });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 358, height: 179 } as DOMRect);
    const user = userEvent.setup();
    renderMap({ countryId: "italy", regionId: null });
    const labeled = () => within(map()).getByRole("button", { name: "Emilia-Romagna" }).querySelector("text");
    for (let i = 0; i < 4 && !labeled(); i++) await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(labeled()).not.toBeNull();
  });

  it("draws the outlines in on first reveal at world view", () => {
    renderMap(WORLD);
    const outlines = map().querySelectorAll("path.draw");
    expect(outlines.length).toBeGreaterThan(150);
    outlines.forEach((outline) => expect(outline.getAttribute("pathLength")).toBe("1"));
  });

  // A non-scaling stroke dashes in screen px while pathLength measures the path in viewBox units, so on
  // a map drawn wider than its viewBox the one-outline dash would run out before the outline does.
  it("draws in with ordinary strokes, sized to stay hairlines at any width", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 1800, height: 900 } as DOMRect);
    renderMap(WORLD);
    const outlines = Array.from(map().querySelectorAll("path.draw"));
    outlines.forEach((outline) => expect(outline).not.toHaveAttribute("vector-effect"));
    const france = within(map()).getByRole("button", { name: "France" });
    expect(Number(france.getAttribute("stroke-width")) * 1.5).toBeCloseTo(1);
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
