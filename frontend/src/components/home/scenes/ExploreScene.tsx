import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listWines } from "../../../services/api";
import type { WineListItem } from "../../../types/wine";
import { formatPrice } from "../../../utils/format";
import { Glass } from "../art/Glass";
import { cssVars } from "../art/cssVars";
import { Scene, SceneCta } from "../Scene";

const SAMPLE_SIZE = 3;
const FALLBACK_COPY = "Hundreds of wines by type, country, grape and price.";
const COLORS = ["red", "white", "rosé"] as const;
const COLOR_LIMIT = 20;

type WinesState = { status: "loading" } | { status: "loaded"; wines: WineListItem[] } | { status: "error" };

/**
 * Picks one wine per color (in the given order), skipping colors with no
 * items. If fewer than SAMPLE_SIZE wines were picked, tops up from any
 * remaining items across all colors, never duplicating a wine by id.
 */
export function pickWines(
  responsesByColor: readonly WineListItem[][],
  random: () => number = Math.random
): WineListItem[] {
  const picked: WineListItem[] = [];
  const pickedIds = new Set<number>();
  const leftovers: WineListItem[] = [];

  for (const items of responsesByColor) {
    if (items.length === 0) continue;
    const index = Math.floor(random() * items.length);
    const chosen = items[index];
    if (!pickedIds.has(chosen.id)) {
      picked.push(chosen);
      pickedIds.add(chosen.id);
    }
    items.forEach((item, i) => {
      if (i !== index) leftovers.push(item);
    });
  }

  for (const item of leftovers) {
    if (picked.length >= SAMPLE_SIZE) break;
    if (!pickedIds.has(item.id)) {
      picked.push(item);
      pickedIds.add(item.id);
    }
  }

  return picked;
}

function Bottle() {
  return (
    <path
      className="stroke-accent"
      fill="none"
      strokeWidth="1.2"
      strokeLinejoin="round"
      d="M-6 0 H6 V22 Q16 30 16 44 V120 H-16 V44 Q-16 30 -6 22 Z"
    />
  );
}

function ExploreArt() {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-sm mx-auto" focusable="false">
      <g transform="translate(58 80) scale(0.8)">
        <g className="fan" style={cssVars({ "--fan": "-14deg", "--delay": "0.6s" })}>
          <Bottle />
        </g>
      </g>
      <g transform="translate(100 70) scale(0.8)">
        <g className="fan" style={cssVars({ "--fan": "0deg", "--delay": "0.75s" })}>
          <Bottle />
        </g>
      </g>
      <g transform="translate(142 80) scale(0.8)">
        <g className="fan" style={cssVars({ "--fan": "14deg", "--delay": "0.9s" })}>
          <Bottle />
        </g>
      </g>
      <Glass wine="red" level="mid" />
    </svg>
  );
}

function WineRows({ state }: { state: WinesState }) {
  if (state.status === "loading") {
    return (
      <>
        <p role="status" className="sr-only">
          Loading wines…
        </p>
        <ul className="grid gap-2 mb-6" aria-busy="true" aria-hidden="true">
          {Array.from({ length: SAMPLE_SIZE }, (_, i) => (
            <li key={i} data-testid="wine-skeleton" className="h-14 rounded border border-surface-border" />
          ))}
        </ul>
      </>
    );
  }

  if (state.status === "error" || state.wines.length === 0) {
    return <p className="text-ink-muted mb-6">{FALLBACK_COPY}</p>;
  }

  return (
    <ul className="grid gap-2 mb-6">
      {state.wines.map((wine, i) => (
        <li key={wine.id} className="pop" style={cssVars({ "--delay": `${0.8 + i * 0.15}s` })}>
          <Link
            to={`/wines/${wine.id}`}
            className="flex items-center justify-between gap-4 rounded border border-surface-border px-4 py-3 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span>
              <span className="block text-ink">{wine.name}</span>
              <span className="block text-sm text-ink-muted">
                {wine.type}
                {wine.country ? ` · ${wine.country}` : ""}
              </span>
            </span>
            <span className="text-sm text-ink whitespace-nowrap">{formatPrice(wine.price, wine.currency)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ExploreScene() {
  const [state, setState] = useState<WinesState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    Promise.allSettled(COLORS.map((type) => listWines({ type, limit: COLOR_LIMIT }))).then((results) => {
      if (!active) return;
      const itemsByColor = results.map((result) => (result.status === "fulfilled" ? result.value.items : []));
      const wines = pickWines(itemsByColor);
      setState(wines.length > 0 ? { status: "loaded", wines } : { status: "error" });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Scene id="explore" index={1} label="Explore" title="Wander the whole cellar." side="left" art={<ExploreArt />}>
      <p className="text-ink-muted mb-6">
        Browse a real catalog by type, country, grape, and price — every wine with a full detail page and
        links to retailers.
      </p>
      <WineRows state={state} />
      <SceneCta to="/explore">Explore Wines</SceneCta>
    </Scene>
  );
}
