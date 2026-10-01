import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listWines } from "../../../services/api";

export function GrapeExploreLink({ name, exploreGrape }: { name: string; exploreGrape: string }) {
  const [count, setCount] = useState<number | null>(null);

  // Same filter the link applies, so the count always matches what Explore shows.
  useEffect(() => {
    let active = true;
    setCount(null);
    listWines({ grape: exploreGrape, limit: 1 })
      .then((response) => {
        if (active) setCount(response.total);
      })
      .catch(() => {
        // No count is fine; the link still works.
      });
    return () => {
      active = false;
    };
  }, [exploreGrape]);

  // A zero count would read as a dead end, so it falls back to the plain label.
  const label = !count ? `Explore ${name} wines` : `Explore ${count} ${name} ${count === 1 ? "wine" : "wines"}`;

  return (
    <Link
      to={`/explore?grape=${encodeURIComponent(exploreGrape)}`}
      className="inline-block border border-accent text-accent font-semibold px-5 py-2.5 rounded hover:bg-accent hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {label} <span aria-hidden="true">→</span>
    </Link>
  );
}
