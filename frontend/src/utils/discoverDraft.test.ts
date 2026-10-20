import { describe, it, expect } from "vitest";
import { answersToDraft, draftToAnswers, EMPTY_DRAFT } from "./discoverDraft";

describe("draftToAnswers", () => {
  it("omits unanswered questions", () => {
    expect(draftToAnswers(EMPTY_DRAFT)).toEqual({});
  });

  it("sends lists, single taste levels as numbers and the budget as prices", () => {
    expect(
      draftToAnswers({
        ...EMPTY_DRAFT,
        type: ["red", "white"],
        country: ["France"],
        budget: ["20-40", "40-80"],
        sweetness: [2],
        body: [2, 4],
      })
    ).toEqual({ type: ["red", "white"], country: ["France"], sweetness: 2, body: [2, 4], min_price: 20, max_price: 80 });
  });
});

describe("answersToDraft", () => {
  it("maps legacy single values and free-form prices", () => {
    expect(answersToDraft({ type: "red", country: "Italy", sweetness: 2, min_price: 25, max_price: 60 })).toEqual({
      ...EMPTY_DRAFT,
      type: ["red"],
      country: ["Italy"],
      sweetness: [2],
      budget: ["20-40", "40-80"],
    });
  });

  it("keeps only values matching an option, normalised to the option's value", () => {
    const draft = answersToDraft({ type: ["RED", "plaid", "Rosé"], country: ["italy", "Atlantis", "ITALY"] });
    expect(draft.type).toEqual(["red", "rosé"]);
    expect(draft.country).toEqual(["Italy"]);
  });

  it("round-trips a new-style draft", () => {
    const draft = { ...EMPTY_DRAFT, type: ["rosé"], tannin: [1, 2], budget: ["150-plus"] };
    expect(answersToDraft(draftToAnswers(draft))).toEqual(draft);
  });
});
