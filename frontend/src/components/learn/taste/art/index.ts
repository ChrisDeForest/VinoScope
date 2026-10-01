import type { Dimension } from "../../../../utils/dimensionLabels";
import { AcidityArt } from "./AcidityArt";
import { BodyArt } from "./BodyArt";
import { FruitArt } from "./FruitArt";
import { SweetnessArt } from "./SweetnessArt";
import { TanninArt } from "./TanninArt";

export const DIMENSION_ART: Record<Dimension, () => JSX.Element> = {
  sweetness: SweetnessArt,
  acidity: AcidityArt,
  tannin: TanninArt,
  body: BodyArt,
  fruitiness: FruitArt,
};
