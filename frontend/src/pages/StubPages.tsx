import { StubPage } from "../components/common/StubPage";

export function DiscoverPage() {
  return (
    <StubPage
      title="Discover"
      description="Discover will be a short questionnaire about what you like — sweetness, body, tannin, acidity, food pairings, and more. Answers you're unsure about are left out rather than guessed, and your answers become a preference profile that's matched against every wine in the catalog using a weighted similarity score. This page doesn't have a working questionnaire yet."
    />
  );
}

export function PairPage() {
  return (
    <StubPage
      title="Pair"
      description="Pair will help you find a wine for a specific dish — steak, seafood, pasta, dessert, and more — by turning the food into the same kind of preference vector Discover uses, then matching it against the catalog. This page doesn't have working pairing search yet."
    />
  );
}

export function ComparePage() {
  return (
    <StubPage
      title="Compare"
      description="Compare will let you put two to four wines side by side — price, region, grape, ABV, and characteristics like tannin and body — with a radar chart to make the differences easy to see at a glance. This page doesn't have working comparison yet."
    />
  );
}

export function LearnPage() {
  return (
    <StubPage
      title="Learn"
      description="Learn will cover the basics behind the terms used across the site: grape varieties, wine regions, and concepts like tannin, acidity, body, and terroir. This page doesn't have real content yet."
    />
  );
}
