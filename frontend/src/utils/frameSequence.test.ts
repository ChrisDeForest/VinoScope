import { describe, it, expect } from "vitest";
import {
  frameIndexForProgress,
  frameSetForViewport,
  placementForSet,
  frameUrl,
  nearestLoadedFrame,
  placeFrame,
  posterUrl,
} from "./frameSequence";

describe("frameSetForViewport", () => {
  const pick = (width: number, height: number, pixelRatio = 1) => frameSetForViewport({ width, height, pixelRatio });

  it("uses the mobile set at 768px wide and below, whatever the density", () => {
    expect(pick(375, 812, 3)).toBe("mobile");
    expect(pick(768, 1024, 2)).toBe("mobile");
  });

  it("uses the 1080p desktop set when it needs no more than ~10% enlargement", () => {
    expect(pick(769, 600)).toBe("desktop");
    expect(pick(1920, 1080)).toBe("desktop");
    expect(pick(1280, 720, 1.5)).toBe("desktop");
    expect(pick(2112, 1188)).toBe("desktop");
  });

  it("uses the 1440p desktop set when the hero covers more physical pixels", () => {
    expect(pick(2113, 1188)).toBe("desktop-1440");
    expect(pick(2560, 1440)).toBe("desktop-1440");
    expect(pick(3440, 1440)).toBe("desktop-1440");
    expect(pick(1440, 900, 2)).toBe("desktop-1440");
  });

  it("accounts for cover cropping on tall viewports", () => {
    // 1200px tall needs a 2133px-wide 16:9 frame to fill it.
    expect(pick(1000, 1200)).toBe("desktop-1440");
  });

  it("caps pixel density at 2, matching the canvas backing store", () => {
    expect(pick(1000, 560, 3)).toBe("desktop");
  });

  it("treats a missing or invalid pixel ratio as 1", () => {
    expect(pick(1920, 1080, 0)).toBe("desktop");
    expect(pick(1920, 1080, Number.NaN)).toBe("desktop");
  });
});

describe("placementForSet", () => {
  it("fits mobile frames to the width and covers with desktop frames", () => {
    expect(placementForSet("mobile")).toBe("fit-width-bottom");
    expect(placementForSet("desktop")).toBe("cover");
    expect(placementForSet("desktop-1440")).toBe("cover");
  });
});

describe("frameUrl / posterUrl", () => {
  it("builds 1-based, zero-padded frame paths from a 0-based index", () => {
    expect(frameUrl("desktop", 0)).toBe("/hero/desktop/frame-001.webp");
    expect(frameUrl("mobile", 63)).toBe("/hero/mobile/frame-064.webp");
  });

  it("builds poster paths", () => {
    expect(posterUrl("desktop")).toBe("/hero/desktop/poster.webp");
    expect(posterUrl("mobile")).toBe("/hero/mobile/poster.webp");
  });
});

describe("frameIndexForProgress", () => {
  it("maps 0 and 1 to the first and last frame", () => {
    expect(frameIndexForProgress(0, 64)).toBe(0);
    expect(frameIndexForProgress(1, 64)).toBe(63);
  });

  it("rounds to the nearest frame", () => {
    expect(frameIndexForProgress(0.5, 64)).toBe(32);
    expect(frameIndexForProgress(0.51, 11)).toBe(5);
  });

  it("clamps out-of-range and non-finite progress", () => {
    expect(frameIndexForProgress(-0.3, 64)).toBe(0);
    expect(frameIndexForProgress(1.7, 64)).toBe(63);
    expect(frameIndexForProgress(Number.NaN, 64)).toBe(0);
  });

  it("returns 0 when there are no frames", () => {
    expect(frameIndexForProgress(0.5, 0)).toBe(0);
  });
});

describe("nearestLoadedFrame", () => {
  it("returns the target when it is loaded", () => {
    expect(nearestLoadedFrame(2, [false, false, true, false])).toBe(2);
  });

  it("returns the closest loaded frame, preferring the lower one on ties", () => {
    expect(nearestLoadedFrame(2, [false, true, false, true])).toBe(1);
    expect(nearestLoadedFrame(0, [false, false, true])).toBe(2);
  });

  it("clamps targets outside the range", () => {
    expect(nearestLoadedFrame(70, [true, false, false])).toBe(0);
    expect(nearestLoadedFrame(-4, [false, false, true])).toBe(2);
  });

  it("returns null when nothing is loaded", () => {
    expect(nearestLoadedFrame(1, [false, false])).toBeNull();
    expect(nearestLoadedFrame(0, [])).toBeNull();
  });
});

describe("placeFrame", () => {
  it("covers the destination, cropping and centering the overflow", () => {
    expect(placeFrame("cover", 1280, 720, 1280, 1440)).toEqual({ x: -640, y: 0, width: 2560, height: 1440 });
    expect(placeFrame("cover", 1280, 720, 1280, 360)).toEqual({ x: 0, y: -180, width: 1280, height: 720 });
  });

  it("fits the width and anchors to the bottom", () => {
    expect(placeFrame("fit-width-bottom", 540, 720, 375, 812)).toEqual({ x: 0, y: 312, width: 375, height: 500 });
  });
});
