import { describe, it, expect, afterEach } from "vitest";
import { prefersLightweightMedia } from "./connection";

function stubConnection(value: unknown) {
  Object.defineProperty(navigator, "connection", { value, configurable: true });
}

afterEach(() => {
  // @ts-expect-error -- test-only cleanup of a non-standard navigator property
  delete navigator.connection;
});

describe("prefersLightweightMedia", () => {
  it("is false when navigator.connection is absent", () => {
    expect(prefersLightweightMedia()).toBe(false);
  });

  it("is true when saveData is on", () => {
    stubConnection({ saveData: true, effectiveType: "4g" });
    expect(prefersLightweightMedia()).toBe(true);
  });

  it.each(["slow-2g", "2g", "3g"])("is true when effectiveType is %s", (effectiveType) => {
    stubConnection({ saveData: false, effectiveType });
    expect(prefersLightweightMedia()).toBe(true);
  });

  it("is false on a fast connection with saveData off", () => {
    stubConnection({ saveData: false, effectiveType: "4g" });
    expect(prefersLightweightMedia()).toBe(false);
  });
});
