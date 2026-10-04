import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
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
  OVERLAY_CLEARANCE_PX,
  PIN,
  US_STATE_LINES_PATH,
  WORLD_FEATURES,
  countryTransform,
  detailFeature,
  labelAnchor,
  pathFor,
  placeLabels,
  projectPoint,
} from "./geo";
import type { MapSelection } from "./useMapSelection";

interface RegionsMapProps {
  selection: MapSelection;
  /** True when the drawer covers the map's right edge, so the zoom centers in the space left of it. */
  inset: boolean;
  /** True when the "← World" button and breadcrumb sit over the map's top-left, so the zoom keeps clear of them. */
  overlayTop?: boolean;
  onSelectCountry: (id: string) => void;
  onSelectRegion: (id: string) => void;
}

const WINE_ATLAS_NAMES = new Set(MAP_COUNTRIES.map((country) => country.atlasName));
const OTHER_SHAPES = WORLD_FEATURES.filter((f) => !WINE_ATLAS_NAMES.has(f.properties.name)).map((f) => ({
  key: String(f.id ?? f.properties.name),
  d: pathFor(f),
}));
// Wine countries always use the detailed outline: they're the ones readers zoom into.
const COUNTRY_SHAPES = MAP_COUNTRIES.map((country) => ({ country, d: pathFor(detailFeature(country.atlasName)!) }));

/** The shared draw-in (`.draw` in home.css) runs 1.2s; the dash comes off a little after it ends. */
const DRAW_IN_MS = 1400;

function activate(event: KeyboardEvent, action: () => void) {
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

export function RegionsMap({ selection, inset, overlayTop = false, onSelectCountry, onSelectRegion }: RegionsMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useReveal(ref);
  const reducedMotion = usePrefersReducedMotion();
  const renderedWidth = useRenderedWidth(ref);
  const country = selection.countryId ? countryById(selection.countryId) : undefined;
  const clear = { top: overlayTop ? OVERLAY_CLEARANCE_PX : 0, right: inset ? DRAWER_CLEARANCE_PX : 0 };
  const { k, tx, ty } = country ? countryTransform(country, renderedWidth, clear) : IDENTITY;
  /** One screen px in the zoom group's units: pins are sized with it so they look the same at every zoom and width. */
  const s = renderedWidth / MAP_WIDTH;
  const px = 1 / (k * s);

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
  const draw = dashed ? { className: "draw", pathLength: 1 } : { className: "", pathLength: undefined };

  const pins = country
    ? regionsOf(country.id).map((region) => {
        const point = projectPoint(region.coords);
        return { region, point, selected: region.id === selection.regionId };
      })
    : [];
  const labels = placeLabels(
    pins.map(({ region, point: [x, y], selected }) => ({
      id: region.id,
      name: region.name,
      point: [(k * x + tx) * s, (k * y + ty) * s] as const,
      preferred: region.labelSide,
      selected,
    })),
    [
      [0, clear.top],
      [renderedWidth - Math.min(clear.right, renderedWidth * 0.6), MAP_HEIGHT * s],
    ]
  );

  return (
    <div ref={ref} className={["scene", ...reveal].join(" ")}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label="World wine map" className="block h-auto w-full">
        <g
          data-testid="map-zoom"
          className={reducedMotion ? "map-zoom" : "map-zoom map-zoom-animate"}
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}
        >
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
              <path
                key={key}
                d={d}
                fill="none"
                className={draw.className ? "draw stroke-accent" : "stroke-accent"}
                strokeOpacity={0.4}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                pathLength={draw.pathLength}
              />
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
                className={`map-country${draw.className ? " draw" : ""} stroke-accent${state}`}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                pathLength={draw.pathLength}
                onClick={() => onSelectCountry(shape.id)}
                onKeyDown={(event) => activate(event, () => onSelectCountry(shape.id))}
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
                onClick={() => onSelectRegion(region.id)}
                onKeyDown={(event) => activate(event, () => onSelectRegion(region.id))}
              >
                <circle cx={x} cy={y} r={PIN.hit * px} className="map-pin-hit" />
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
    </div>
  );
}
