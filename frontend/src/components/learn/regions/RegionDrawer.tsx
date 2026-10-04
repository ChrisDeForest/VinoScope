import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import {
  countryById,
  keyGrapeId,
  regionById,
  regionsOf,
  type MapCountry,
  type MapRegion,
} from "../../../content/learn/regions";
import { ClimateScale } from "./ClimateScale";
import { useCatalogCount } from "./useCatalogCount";

export interface RegionDrawerProps {
  countryId: string;
  regionId: string | null;
  headingRef: RefObject<HTMLHeadingElement>;
  onClose: () => void;
  onSelectRegion: (id: string) => void;
  onBackToCountry: () => void;
}

const LABEL = "mt-4 text-xs uppercase tracking-[0.18em] text-ink-muted";
const CHIP = "rounded-full border px-2.5 py-0.5 text-xs";
const EXPLORE =
  "mt-5 inline-block rounded border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function RegionDrawer({ countryId, regionId, headingRef, onClose, onSelectRegion, onBackToCountry }: RegionDrawerProps) {
  const country = countryById(countryId);
  const region = regionId ? regionById(regionId) : undefined;
  const scrollRef = useRef<HTMLElement>(null);
  // The drawer is reused between views; each new view starts at its heading, not where the last one was scrolled.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [countryId, regionId]);
  if (!country) return null;
  const title = region?.name ?? country.name;

  return (
    <aside
      ref={scrollRef}
      aria-label={`${title} details`}
      className="region-drawer overflow-y-auto rounded-lg border border-surface-border bg-surface-raised p-5 shadow-2xl"
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="float-right -mr-1 -mt-1 text-2xl leading-none text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        ×
      </button>
      {region ? (
        <RegionView country={country} region={region} headingRef={headingRef} onBackToCountry={onBackToCountry} />
      ) : (
        <CountryView country={country} headingRef={headingRef} onSelectRegion={onSelectRegion} />
      )}
    </aside>
  );
}

function Heading({ eyebrow, headingRef, children }: { eyebrow: string; headingRef: RefObject<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">{eyebrow}</p>
      <h3 ref={headingRef} tabIndex={-1} className="mt-1 font-serif text-2xl text-ink focus:outline-none">
        {children}
      </h3>
    </>
  );
}

function CountryView({
  country,
  headingRef,
  onSelectRegion,
}: {
  country: MapCountry;
  headingRef: RefObject<HTMLHeadingElement>;
  onSelectRegion: (id: string) => void;
}) {
  const count = useCatalogCount({ country: country.exploreCountry });
  return (
    <>
      <Heading eyebrow="Country" headingRef={headingRef}>
        {country.name}
      </Heading>
      <p className="mt-2 text-sm leading-relaxed text-ink">{country.overview}</p>
      <p className={LABEL}>Regions</p>
      <ul className="mt-1">
        {regionsOf(country.id).map((region) => (
          <RegionRow key={region.id} region={region} onSelect={() => onSelectRegion(region.id)} />
        ))}
      </ul>
      <Link to={`/explore?country=${encodeURIComponent(country.exploreCountry)}`} className={EXPLORE}>
        {count ? `Explore ${count} ${count === 1 ? "wine" : "wines"} from ${country.name}` : `Explore wines from ${country.name}`}{" "}
        <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}

function RegionRow({ region, onSelect }: { region: MapRegion; onSelect: () => void }) {
  const count = useCatalogCount(region.exploreRegion ? { region: region.exploreRegion } : null);
  return (
    <li className="border-b border-surface-border">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between py-2 text-left text-sm text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span data-name="">{region.name}</span>
        <span className="text-xs text-ink-muted">{count ? `${count} in catalog` : "—"}</span>
      </button>
    </li>
  );
}

function RegionView({
  country,
  region,
  headingRef,
  onBackToCountry,
}: {
  country: MapCountry;
  region: MapRegion;
  headingRef: RefObject<HTMLHeadingElement>;
  onBackToCountry: () => void;
}) {
  const count = useCatalogCount(region.exploreRegion ? { region: region.exploreRegion } : null);
  const label = region.exploreLabel ?? region.name;
  const none = !region.exploreRegion || count === 0;

  return (
    <>
      <Heading eyebrow={`${country.name} · Region`} headingRef={headingRef}>
        {region.name}
      </Heading>
      <p className="mt-2 text-sm leading-relaxed text-ink">{region.about}</p>
      <p className={LABEL}>Climate</p>
      <ClimateScale value={region.climate} label={region.climateLabel} />
      <p className={LABEL}>Key grapes</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {region.grapes.map((grape) => {
          const id = keyGrapeId(grape);
          return id ? (
            <a key={grape} href={`#grape-${id}`} className={`${CHIP} border-accent text-accent hover:underline`}>
              {grape}
            </a>
          ) : (
            <span key={grape} className={`${CHIP} border-surface-border text-ink`}>
              {grape}
            </span>
          );
        })}
      </div>
      <p className={LABEL}>Signature styles</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {region.styles.map((style) => (
          <span key={style} className={`${CHIP} border-surface-border text-ink`}>
            {style}
          </span>
        ))}
      </div>
      <p className={LABEL}>Worth knowing</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{region.fact}</p>
      {none ? (
        <p className="mt-5 text-sm text-ink-muted">No {region.name} wines in the catalog yet.</p>
      ) : (
        <Link to={`/explore?region=${encodeURIComponent(region.exploreRegion!)}`} className={EXPLORE}>
          {count ? `Explore ${count} ${label} ${count === 1 ? "wine" : "wines"}` : `Explore ${label} wines`}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <p className="mt-4">
        <button
          type="button"
          onClick={onBackToCountry}
          className="text-sm text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span aria-hidden="true">← </span>All of {country.name}
        </button>
      </p>
    </>
  );
}
