import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { MAP_COUNTRIES, countryById, regionsOf } from "../../../content/learn/regions";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { useReveal } from "../../../hooks/useReveal";
import { cssVars } from "../../home/art/cssVars";
import {
  DRAWER_CLEARANCE_PX,
  GRATICULE_PATH,
  IDENTITY,
  MAP_HEIGHT,
  MAP_WIDTH,
  NEAR_FEATURES,
  OVERLAY_CLEARANCE_PX,
  PIN,
  US_STATE_LINES_PATH,
  WORLD_FEATURES,
  ZOOM_STEP,
  clampCenter,
  countryTransform,
  detailFeature,
  hitRadii,
  interpolateTransform,
  labelAnchor,
  maxUserZoom,
  pathFor,
  placeLabels,
  projectPoint,
  projectedBox,
  transformAt,
  viewCenter,
  visibleViewport,
  type ZoomTransform,
} from "./geo";
import type { MapSelection } from "./useMapSelection";

interface RegionsMapProps {
  selection: MapSelection;
  /** True when the drawer covers the map's right edge, so the zoom centers in the space left of it. */
  inset: boolean;
  /** True when the "← World" button and breadcrumb sit over the map's top-left, so the zoom keeps clear of them. */
  overlayTop?: boolean;
  /** `opener` is the clicked shape or pin, so focus can return to it (Safari doesn't focus on click). */
  onSelectCountry: (id: string, opener?: Element) => void;
  onSelectRegion: (id: string, opener?: Element) => void;
}

const WINE_ATLAS_NAMES = new Set(MAP_COUNTRIES.map((country) => country.atlasName));
const NEAR_NAMES = new Set(NEAR_FEATURES.map((f) => f.properties.name));
// Wine countries' neighbors use the detailed outline too, so their shared borders line up when zoomed.
const OTHER_SHAPES = [
  ...WORLD_FEATURES.filter((f) => !WINE_ATLAS_NAMES.has(f.properties.name) && !NEAR_NAMES.has(f.properties.name)),
  ...NEAR_FEATURES,
].map((f) => ({ key: String(f.id ?? f.properties.name), d: pathFor(f) }));
// Wine countries always use the detailed outline: they're the ones readers zoom into.
const COUNTRY_SHAPES = MAP_COUNTRIES.map((country) => ({ country, d: pathFor(detailFeature(country.atlasName)!) }));

/** The shared draw-in (`.draw` in home.css) runs 1.2s; the dash comes off a little after it ends. */
const DRAW_IN_MS = 1400;
/** The fly-over between the world and a country, and a zoom button's smaller step. */
const GLIDE_MS = 1100;
const STEP_MS = 320;
/** A press that moves less than this (CSS px) is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 4;

function activate(event: KeyboardEvent<Element>, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

/** The element's on-screen width in CSS px; the viewBox width until it can be measured. */
function useRenderedWidth(ref: RefObject<Element>): number {
  const [width, setWidth] = useState(MAP_WIDTH);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const next = element.getBoundingClientRect().width;
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Close to the old CSS curve, cubic-bezier(0.2, 0.8, 0.2, 1): quick to start, long to settle. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Glides to `target` over `durationMs` (0 jumps). The zoom is animated here rather than by a CSS
 * transition so every frame renders with its own zoom, and pins keep their on-screen size mid-glide.
 */
function useGlide(target: ZoomTransform, durationMs: number): ZoomTransform {
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(target);
  useEffect(() => {
    const from = currentRef.current;
    if (from.k === target.k && from.tx === target.tx && from.ty === target.ty) return;
    const jump = () => {
      currentRef.current = target;
      setCurrent(target);
    };
    if (durationMs <= 0 || typeof requestAnimationFrame !== "function") return jump();
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = t >= 1 ? target : interpolateTransform(from, target, easeOut(t));
      currentRef.current = next;
      setCurrent(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // The target is compared by value: a new object with the same numbers is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.k, target.tx, target.ty, durationMs]);
  return current;
}

/** The reader's own zoom on top of the fitted view: a factor (1 = fitted) and the map point at the middle. */
interface UserView {
  /** Which fitted view this zoom belongs to; a new country, drawer or width starts over at the fit. */
  key: string;
  zoom: number;
  center: [number, number];
}

function ZoomIcon({ kind }: { kind: "in" | "out" | "fit" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
      {kind === "fit" ? (
        <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={kind === "in" ? "M10 4v12M4 10h12" : "M4 10h12"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function RegionsMap({ selection, inset, overlayTop = false, onSelectCountry, onSelectRegion }: RegionsMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useReveal(ref);
  const reducedMotion = usePrefersReducedMotion();
  const renderedWidth = useRenderedWidth(ref);
  const country = selection.countryId ? countryById(selection.countryId) : undefined;
  const clear = { top: overlayTop ? OVERLAY_CLEARANCE_PX : 0, right: inset ? DRAWER_CLEARANCE_PX : 0 };
  const viewport = visibleViewport(renderedWidth, clear);
  const fit = country ? countryTransform(country, renderedWidth, clear) : IDENTITY;
  const fitKey = `${country?.id ?? "world"}:${fit.k}:${fit.tx}:${fit.ty}`;
  const maxZoom = country ? maxUserZoom(fit.k) : 1;

  const [userView, setUserView] = useState<UserView | null>(null);
  const user = userView?.key === fitKey ? userView : null;
  const zoom = user?.zoom ?? 1;
  const target = user ? transformAt(fit.k * user.zoom, user.center, viewport) : fit;
  /** How long the next glide takes: set by whatever changes the view, reset to the fly-over for a new country. */
  const glideMs = useRef(GLIDE_MS);
  if (!user) glideMs.current = GLIDE_MS;
  const { k, tx, ty } = useGlide(target, reducedMotion ? 0 : glideMs.current);

  /** One screen px in the zoom group's units: pins are sized with it so they look the same at every zoom and width. */
  const s = renderedWidth / MAP_WIDTH;
  const px = 1 / (k * s);

  function zoomBy(factor: number) {
    if (!country) return;
    const next = Math.min(maxZoom, Math.max(1, zoom * factor));
    const center = user?.center ?? viewCenter(fit, viewport);
    glideMs.current = STEP_MS;
    setUserView({ key: fitKey, zoom: next, center: next === 1 ? viewCenter(fit, viewport) : center });
  }

  function resetZoom() {
    glideMs.current = STEP_MS;
    setUserView(null);
  }

  // Drag to pan, once zoomed past the fitted view. A drag never counts as a click on what it started on.
  const drag = useRef<{ x: number; y: number; center: [number, number]; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const pannable = Boolean(country) && zoom > 1;

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!pannable || !user || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = { x: event.clientX, y: event.clientY, center: user.center, moved: false };
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const start = drag.current;
    if (!start || !country || !user) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      start.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const scale = fit.k * user.zoom * s;
    const center = clampCenter([start.center[0] - dx / scale, start.center[1] - dy / scale], projectedBox(country.fitBounds));
    glideMs.current = 0;
    setUserView({ ...user, center });
  }

  function onPointerUp() {
    suppressClick.current = Boolean(drag.current?.moved);
    drag.current = null;
  }

  // The draw-in dashes each outline (`.draw` + pathLength). Non-scaling strokes dash in screen space, so
  // a zoomed outline would break into dashes: the dash comes off once the draw-in has played, the moment
  // the map zooms, and never goes on under reduced motion.
  const revealed = reveal.includes("is-visible");
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (country) setDrawn(true);
  }, [country]);
  useEffect(() => {
    if (drawn || reducedMotion || !revealed) return;
    const timer = setTimeout(() => setDrawn(true), DRAW_IN_MS);
    return () => clearTimeout(timer);
  }, [drawn, reducedMotion, revealed]);
  const dashed = !drawn && !reducedMotion && !country;
  /**
   * Stroke props for an outline `width` screen px wide. While dashed (only ever at world view) the stroke
   * scales normally, so its one-outline-long dash is measured in the same units as the path and the
   * draw-in reaches the end however wide the map is drawn; otherwise the stroke ignores the zoom.
   */
  const outline = (width: number) =>
    dashed
      ? { strokeWidth: width / s, pathLength: 1, vectorEffect: undefined }
      : { strokeWidth: width, pathLength: undefined, vectorEffect: "non-scaling-stroke" as const };

  const pins = country
    ? regionsOf(country.id).map((region) => {
        const point = projectPoint(region.coords);
        return { region, point, selected: region.id === selection.regionId };
      })
    : [];
  const toScreen = ([x, y]: readonly [number, number], view: ZoomTransform) => [(view.k * x + view.tx) * s, (view.k * y + view.ty) * s] as const;
  // Label sides come from where the view is headed, so they don't flip back and forth mid-glide.
  const labels = placeLabels(
    pins.map(({ region, point, selected }) => ({
      id: region.id,
      name: region.name,
      point: toScreen(point, target),
      preferred: region.labelSide,
      selected,
    })),
    [
      [0, clear.top],
      [renderedWidth - Math.min(clear.right, renderedWidth * 0.6), MAP_HEIGHT * s],
    ]
  );
  const hits = hitRadii(pins.map(({ point }) => toScreen(point, { k, tx, ty })));

  const controlButton =
    "flex h-8 w-8 items-center justify-center text-accent hover:bg-surface-border disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

  return (
    <div ref={ref} className={["scene relative", ...reveal].join(" ")}>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="group"
        aria-label="World wine map"
        className={`block h-auto w-full ${pannable ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.stopPropagation();
        }}
      >
        <g data-testid="map-zoom" className="map-zoom" style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
          <path
            data-testid="graticule"
            d={GRATICULE_PATH}
            fill="none"
            className="stroke-accent"
            strokeOpacity={0.08}
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
            aria-hidden="true"
          />
          <g aria-hidden="true">
            {OTHER_SHAPES.map(({ key, d }) => (
              <path key={key} d={d} fill="none" className={dashed ? "draw stroke-accent" : "stroke-accent"} strokeOpacity={0.4} {...outline(0.5)} />
            ))}
          </g>
          {COUNTRY_SHAPES.map(({ country: shape, d }) => {
            const selected = shape.id === selection.countryId;
            const state = selected ? " is-selected" : country ? " is-dim" : "";
            return (
              <path
                key={shape.id}
                d={d}
                role="button"
                // While zoomed, the other countries are dimmed or off-screen; the chips still reach them.
                tabIndex={!country || selected ? 0 : -1}
                aria-label={shape.name}
                aria-pressed={selected}
                className={`map-country${dashed ? " draw" : ""} stroke-accent${state}`}
                {...outline(1)}
                onClick={(event) => onSelectCountry(shape.id, event.currentTarget)}
                onKeyDown={(event) => activate(event, () => onSelectCountry(shape.id, event.currentTarget))}
              />
            );
          })}
          {country?.id === "united-states" ? (
            <path
              data-testid="us-states"
              d={US_STATE_LINES_PATH}
              fill="none"
              className="stroke-accent"
              strokeOpacity={0.35}
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              aria-hidden="true"
            />
          ) : null}
          {pins.map(({ region, point, selected }, i) => {
            const [x, y] = point;
            const side = labels.get(region.id);
            const label = side ? labelAnchor(point, side, px) : null;
            return (
              <g
                key={region.id}
                role="button"
                tabIndex={0}
                aria-label={region.name}
                aria-pressed={selected}
                className={`map-pin${selected ? " is-selected" : ""}`}
                style={cssVars({ "--delay": `${0.85 + i * 0.09}s` })}
                onClick={(event) => onSelectRegion(region.id, event.currentTarget)}
                onKeyDown={(event) => activate(event, () => onSelectRegion(region.id, event.currentTarget))}
              >
                <circle cx={x} cy={y} r={hits[i] * px} className="map-pin-hit" />
                <circle cx={x} cy={y} r={(selected ? PIN.haloSelected : PIN.halo) * px} className="map-pin-halo" />
                <circle cx={x} cy={y} r={PIN.core * px} strokeWidth={PIN.stroke * px} className="map-pin-core" />
                {label ? (
                  <text x={label.x} y={label.y} textAnchor={label.anchor} fontSize={PIN.font * px} className="map-pin-label fill-ink font-serif">
                    {region.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {country ? (
        <div
          role="group"
          aria-label="Map zoom"
          className="absolute bottom-3 z-[2] flex flex-col overflow-hidden rounded border border-surface-border bg-surface-raised shadow"
          style={{ right: `${12 + clear.right}px` }}
        >
          <button type="button" aria-label="Zoom in" className={controlButton} disabled={zoom >= maxZoom} onClick={() => zoomBy(ZOOM_STEP)}>
            <ZoomIcon kind="in" />
          </button>
          <button type="button" aria-label="Zoom out" className={`${controlButton} border-t border-surface-border`} disabled={zoom <= 1} onClick={() => zoomBy(1 / ZOOM_STEP)}>
            <ZoomIcon kind="out" />
          </button>
          <button type="button" aria-label={`Fit ${country.name}`} className={`${controlButton} border-t border-surface-border`} disabled={!user} onClick={resetZoom}>
            <ZoomIcon kind="fit" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
