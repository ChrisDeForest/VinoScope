import { HeroPour } from "../components/home/HeroPour";
import { Finale } from "../components/home/Finale";
import { ExploreScene } from "../components/home/scenes/ExploreScene";
import { DiscoverScene } from "../components/home/scenes/DiscoverScene";
import { PairScene } from "../components/home/scenes/PairScene";
import { CompareScene } from "../components/home/scenes/CompareScene";
import { LearnScene } from "../components/home/scenes/LearnScene";

export function HomePage() {
  return (
    <>
      <HeroPour />
      <div className="max-w-6xl mx-auto px-4">
        <ExploreScene />
        <DiscoverScene />
        <PairScene />
        <CompareScene />
        <LearnScene />
        <Finale />
      </div>
    </>
  );
}
