import { describe, it, expect } from "vitest";
import { rangeError } from "./priceRange";

describe("rangeError", () => {
  it("accepts open or ordered ranges", () => {
    expect(rangeError(undefined, undefined, "alcohol")).toBeNull();
    expect(rangeError(12, 14, "alcohol")).toBeNull();
  });

  it("names the field in its messages", () => {
    expect(rangeError(14, 12, "alcohol")).toBe("Minimum alcohol must not exceed maximum alcohol.");
    expect(rangeError(-1, undefined, "alcohol")).toBe("Alcohol must be zero or greater.");
  });
});
