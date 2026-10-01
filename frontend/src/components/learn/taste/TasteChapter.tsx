import { useEffect, useState } from "react";
import { TASTE_DIMENSIONS } from "../../../content/learn/taste";
import type { Dimension } from "../../../utils/dimensionLabels";
import { DimensionBlock } from "./DimensionBlock";
import { loadPair, type PairState } from "./pairs";

type Pairs = Partial<Record<Dimension, PairState>>;

const LOADING: PairState = { status: "loading" };

export function TasteChapter() {
  const [pairs, setPairs] = useState<Pairs>({});

  useEffect(() => {
    let active = true;
    for (const { dimension, low, high } of TASTE_DIMENSIONS) {
      loadPair(dimension, low, high).then((state) => {
        if (active) setPairs((previous) => ({ ...previous, [dimension]: state }));
      });
    }
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mt-4">
      {TASTE_DIMENSIONS.map((content, i) => (
        <DimensionBlock
          key={content.dimension}
          content={content}
          pair={pairs[content.dimension] ?? LOADING}
          side={i % 2 === 0 ? "left" : "right"}
        />
      ))}
    </div>
  );
}
