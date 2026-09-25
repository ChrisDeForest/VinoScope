import { Link } from "react-router-dom";

const DESTINATIONS = [
  { to: "/explore", title: "Explore", blurb: "Browse the full catalog" },
  { to: "/discover", title: "Discover", blurb: "Find your wine profile" },
  { to: "/pair", title: "Pair", blurb: "Match wine to food" },
  { to: "/compare", title: "Compare", blurb: "Wines side by side" },
  { to: "/learn", title: "Learn", blurb: "Grapes, regions, terms" },
];

export function Finale() {
  return (
    <section
      id="all-features"
      tabIndex={-1}
      aria-labelledby="finale-title"
      className="py-24 md:min-h-screen flex flex-col justify-center text-center focus:outline-none"
    >
      <h2 id="finale-title" className="font-serif text-3xl md:text-4xl text-ink mb-10">
        Your next favorite bottle is a few clicks away.
      </h2>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-5 text-left">
        {DESTINATIONS.map((destination) => (
          <li key={destination.to}>
            <Link
              to={destination.to}
              className="block h-full rounded border border-surface-border p-4 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="block font-serif text-lg text-ink mb-1">{destination.title}</span>
              <span className="block text-sm text-ink-muted">{destination.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
