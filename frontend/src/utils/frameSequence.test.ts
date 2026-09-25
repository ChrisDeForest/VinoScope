import { describe, it, expect } from "vitest";
import {
  frameIndexForProgress,
  frameSetForWidth,
  frameUrl,
  nearestLoadedFrame,
  placeFrame,
  posterUrl,
} from "./frameSequence";

describe("frameSetForWidth", () => {
  it("uses the mobile set at 768px and below", () => {
    expect(frameSetForWidth(375)).toBe("mobile");
    expect(frameSetForWidth(768)).toBe("mobile");
  });

  it("uses the desktop set above 768px", () => {
    expect(frameSetForWidth(769)).toBe("desktop");
    expect(frameSetForWidth(1440)).toBe("desktop");
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
