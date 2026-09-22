import { describe, it, expect, beforeEach } from "vitest";
import { getStoredProfile, setStoredProfile } from "./discoverProfile";

describe("discoverProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getStoredProfile()).toBeNull();
  });

  it("round-trips a profile through set and get", () => {
    setStoredProfile({ type: "red", sweetness: 1 });
    expect(getStoredProfile()).toEqual({ type: "red", sweetness: 1 });
  });

  it("returns null for corrupted stored data instead of throwing", () => {
    localStorage.setItem("vinoscope-discover-profile", "{not valid json");
    expect(getStoredProfile()).toBeNull();
  });
});
