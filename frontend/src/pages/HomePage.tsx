import { Link } from "react-router-dom";

const TEASERS = [
  { to: "/discover", title: "Discover", blurb: "Find your wine profile" },
  { to: "/pair", title: "Pair", blurb: "Match wine to food" },
  { to: "/compare", title: "Compare", blurb: "Wines side by side" },
  { to: "/learn", title: "Learn", blurb: "Grapes, regions, terms" },
];

export function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="py-12 text-center">
        <h1 className="font-serif text-4xl text-ink mb-4">Find a wine you'll actually enjoy.</h1>
        <p className="text-ink-muted mb-6 max-w-xl mx-auto">
          Browse a real catalog of wines by type, country, grape, and price — with full detail
          pages and outbound links to retailers.
        </p>
        <Link to="/explore" className="inline-block bg-accent text-surface font-semibold px-6 py-3 rounded">
          Explore Wines
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEASERS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="block border border-surface-border rounded p-4 hover:border-accent"
          >
            <h2 className="font-serif text-lg text-ink mb-1">{item.title}</h2>
            <p className="text-sm text-ink-muted">{item.blurb}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
