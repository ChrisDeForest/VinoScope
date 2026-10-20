import { Suspense, lazy, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { countryById, regionById } from "../../../content/learn/regions";
import { CountryChips } from "./CountryChips";
import { RegionDrawer } from "./RegionDrawer";
import { selectionFromHash, useMapSelection } from "./useMapSelection";

// The map and its ~340 KB of geography load as their own chunk, after the rest of the page.
const RegionsMap = lazy(() => import("./RegionsMap").then((module) => ({ default: module.RegionsMap })));

const WIDE_QUERY = "(min-width: 768px)";

function useWideLayout(): boolean {
  const [wide, setWide] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(WIDE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
    setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}

function MapPlaceholder() {
  return <div className="flex aspect-[2/1] w-full items-center justify-center text-sm text-ink-muted">Loading map…</div>;
}

function Legend() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-4 text-xs text-ink-muted md:flex">
      <span className="flex items-center gap-1.5">
        <svg width="14" height="9" viewBox="0 0 14 9">
          <rect x="0.5" y="0.5" width="13" height="8" className="fill-accent stroke-accent" fillOpacity={0.25} />
        </svg>
        Wine country
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="3.5" className="fill-wine-red stroke-accent" strokeWidth={1.3} />
        </svg>
        Region
      </span>
    </div>
  );
}

type Focusable = HTMLElement | SVGElement;

export function RegionsChapter() {
  const location = useLocation();
  const { selection, popCount, selectCountry, selectRegion, showWorld, stepBack } = useMapSelection();
  const wide = useWideLayout();
  const [drawerOpen, setDrawerOpen] = useState(() => selection.countryId !== null);
  // Only the hash present on arrival gets an anchor, so LearnPage's arrival scroll lands on the map.
  const [anchorId] = useState(() => (selectionFromHash(location.hash) ? location.hash.slice(1) : null));
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** The chip, country or pin that opened the drawer: focus goes back to it when the drawer closes. */
  const openerRef = useRef<Focusable | null>(null);
  const focusHeading = useRef(false);
  /** Set when the drawer closes or the map leaves a country: focus returns after the next render. */
  const restoreFocusFrom = useRef<string | null>(null);

  useEffect(() => {
    if (focusHeading.current && drawerOpen) {
      focusHeading.current = false;
      headingRef.current?.focus({ preventScroll: true });
    }
    const countryId = restoreFocusFrom.current;
    if (countryId === null) return;
    restoreFocusFrom.current = null;
    // The opener may be gone (a pin, once the map leaves its country); the country's chip always stays.
    const opener = openerRef.current;
    const target = opener?.isConnected ? opener : rootRef.current?.querySelector<HTMLElement>(`[data-country-id="${countryId}"]`);
    target?.focus({ preventScroll: true });
  });

  // Back/Forward onto a map hash shows that place's drawer again; it doesn't move focus.
  const [seenPops, setSeenPops] = useState(popCount);
  if (popCount !== seenPops) {
    setSeenPops(popCount);
    setDrawerOpen(selection.countryId !== null);
  }

  /**
   * `clicked` is the chip, country or pin that was clicked. Safari doesn't focus buttons on click, so
   * the focused element alone could be stale; keyboard presses focus it first, so either way it's right.
   */
  function openWith(action: () => void, clicked?: Element) {
    // Moving around inside the drawer keeps the original opener; its buttons vanish as the view changes.
    const active = clicked ?? document.activeElement;
    const focusable = active instanceof HTMLElement || active instanceof SVGElement;
    if (focusable && active !== document.body && !active.closest(".region-drawer")) openerRef.current = active;
    focusHeading.current = true;
    action();
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    restoreFocusFrom.current = selection.countryId;
  }

  function goToWorld() {
    restoreFocusFrom.current = selection.countryId;
    setDrawerOpen(false);
    showWorld();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    if (selection.regionId) {
      focusHeading.current = true;
      stepBack();
      setDrawerOpen(true);
    } else if (selection.countryId) {
      goToWorld();
    }
  }

  const country = selection.countryId ? countryById(selection.countryId) : undefined;
  const region = selection.regionId ? regionById(selection.regionId) : undefined;
  const crumb = country ? ["World", country.name, region?.name].filter(Boolean).join(" · ") : "World · 13 wine countries";

  const drawer =
    drawerOpen && country ? (
      <RegionDrawer
        countryId={country.id}
        regionId={selection.regionId}
        headingRef={headingRef}
        onClose={closeDrawer}
        onSelectRegion={(id) => openWith(() => selectRegion(id))}
        onBackToCountry={() => openWith(() => selectCountry(country.id))}
      />
    ) : null;

  // On wide screens the breadcrumb floats over the map's corner (the zoom keeps clear of it);
  // on phones it gets its own row above the map, where it can't cover the pins.
  const breadcrumb = (
    <div className="flex min-h-[2.25rem] items-center gap-3 px-3 pt-2 md:absolute md:left-3 md:top-3 md:z-[2] md:min-h-0 md:p-0">
      {country ? (
        <button
          type="button"
          onClick={goToWorld}
          className="rounded-full border border-accent bg-surface-raised px-3 py-1 text-sm text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span aria-hidden="true">← </span>World
        </button>
      ) : null}
      {/* Not a live region: every change already moves focus to something that announces it. */}
      <p data-testid="map-breadcrumb" className="text-xs uppercase tracking-[0.15em] text-ink-muted">
        {crumb}
      </p>
    </div>
  );

  return (
    <div ref={rootRef} className="mt-8" onKeyDown={onKeyDown}>
      <CountryChips selectedId={selection.countryId} onSelect={(id, opener) => openWith(() => selectCountry(id), opener)} />
      <div className="relative mt-4 overflow-hidden rounded-lg border border-surface-border bg-surface">
        {anchorId ? <span id={anchorId} aria-hidden="true" className="absolute left-0 top-0 scroll-mt-24" /> : null}
        {breadcrumb}
        <Suspense fallback={<MapPlaceholder />}>
          <RegionsMap
            selection={selection}
            inset={wide && drawerOpen}
            overlayTop={wide}
            onSelectCountry={(id, opener) => openWith(() => selectCountry(id), opener)}
            onSelectRegion={(id, opener) => openWith(() => selectRegion(id), opener)}
          />
        </Suspense>
        <Legend />
        {wide ? drawer : null}
      </div>
      {wide ? null : drawer}
    </div>
  );
}
