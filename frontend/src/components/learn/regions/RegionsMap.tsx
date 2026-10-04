import { useRef, type KeyboardEvent } from "react";
import { MAP_COUNTRIES, countryById, regionsOf } from "../../../content/learn/regions";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { useReveal } from "../../../hooks/useReveal";
import { cssVars } from "../../home/art/cssVars";
import {
  GRATICULE_PATH,
  IDENTITY,
  MAP_HEIGHT,
  MAP_WIDTH,
  US_STATE_LINES_PATH,
  WORLD_FEATURES,
  countryTransform,
  detailFeature,
  pathFor,
  projectPoint,
} from "./geo";
import type { MapSelection } from "./useMapSelection";

interface RegionsMapProps {
  selection: MapSelection;
  /** True when the drawer covers the map's right edge, so the zoom centers in the space left of it. */
  inset: boolean;
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

function activate(event: KeyboardEvent, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

export function RegionsMap({ selection, inset, onSelectCountry, onSelectRegion }: RegionsMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useReveal(ref);
  const reducedMotion = usePrefersReducedMotion();
  const country = selection.countryId ? countryById(selection.countryId) : undefined;
  const { k, tx, ty } = country ? countryTransform(country, inset) : IDENTITY;
  const pins = country ? regionsOf(country.id) : [];

  return (
    <div ref={ref} className={["scene", ...reveal].join(" ")}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label="World wine map" className="block h-auto w-full">
        <path d={GRATICULE_PATH} fill="none" className="stroke-accent" strokeOpacity={0.08} strokeWidth={0.6} aria-hidden="true" />
        <g
          data-testid="map-zoom"
          className={reducedMotion ? "map-zoom" : "map-zoom map-zoom-animate"}
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}
        >
          <g aria-hidden="true">
            {OTHER_SHAPES.map(({ key, d }) => (
              <path
                key={key}
                d={d}
                fill="none"
                className="draw stroke-accent"
                strokeOpacity={0.4}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
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
                tabIndex={0}
                aria-label={shape.name}
                aria-pressed={selected}
                className={`map-country draw stroke-accent${state}`}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
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
          {pins.map((region, i) => {
            const [x, y] = projectPoint(region.coords);
            const selected = region.id === selection.regionId;
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
                <circle cx={x} cy={y} r={(selected ? 16 : 10) / k} className="map-pin-halo" />
                <circle cx={x} cy={y} r={4.5 / k} strokeWidth={1.3 / k} className="map-pin-core" />
                <text x={x + 8 / k} y={y + 4 / k} fontSize={12.5 / k} className="fill-ink font-serif">
                  {region.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
