import type { StageId } from "../../../../content/learn/vine";
import { AgeArt } from "./AgeArt";
import { BottleArt } from "./BottleArt";
import { CrushArt } from "./CrushArt";
import { FermentArt } from "./FermentArt";
import { GlassArt } from "./GlassArt";
import { HarvestArt } from "./HarvestArt";
import { VineyardArt } from "./VineyardArt";

export const STAGE_ART: Record<StageId, () => JSX.Element> = {
  vineyard: VineyardArt,
  harvest: HarvestArt,
  crush: CrushArt,
  ferment: FermentArt,
  age: AgeArt,
  bottle: BottleArt,
  glass: GlassArt,
};
