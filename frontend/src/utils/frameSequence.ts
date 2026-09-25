export type FrameSet = "mobile" | "desktop" | "desktop-1440";
export type FramePlacement = "cover" | "fit-width-bottom";

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HERO_FRAME_COUNT = 64;
export const MOBILE_MAX_WIDTH = 768;
// The canvas backing store never exceeds 2x density, so neither should frame choice.
export const MAX_PIXEL_RATIO = 2;
const DESKTOP_FRAME_WIDTH = 1920;
// Tolerate a little enlargement before paying for the 2560px set.
const DESKTOP_UPSCALE_TOLERANCE = 1.1;

// Chooses the smallest frame set that stays sharp on this viewport. Desktop
// frames are drawn "cover", so a tall viewport needs a wider frame than its
// width alone suggests.
export function frameSetForViewport({ width, height, pixelRatio }: { width: number; height: number; pixelRatio: number }): FrameSet {
  if (width <= MOBILE_MAX_WIDTH) return "mobile";
  const density = Number.isFinite(pixelRatio) && pixelRatio > 0 ? Math.min(pixelRatio, MAX_PIXEL_RATIO) : 1;
  const coveredWidth = Math.max(width, (height * 16) / 9) * density;
  return coveredWidth > DESKTOP_FRAME_WIDTH * DESKTOP_UPSCALE_TOLERANCE ? "desktop-1440" : "desktop";
}

export function placementForSet(set: FrameSet): FramePlacement {
  return set === "mobile" ? "fit-width-bottom" : "cover";
}

export function frameUrl(set: FrameSet, index: number): string {
  return `/hero/${set}/frame-${String(index + 1).padStart(3, "0")}.webp`;
}

export function posterUrl(set: FrameSet): string {
  return `/hero/${set}/poster.webp`;
}

export function frameIndexForProgress(progress: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  const safe = Number.isFinite(progress) ? progress : 0;
  const clamped = Math.min(1, Math.max(0, safe));
  return Math.round(clamped * (frameCount - 1));
}

// Closest loaded frame to `target`; on a tie the earlier frame wins so a
// half-loaded sequence never jumps ahead of the pour.
export function nearestLoadedFrame(target: number, loaded: ReadonlyArray<boolean>): number | null {
  if (loaded.length === 0) return null;
  const start = Math.min(Math.max(target, 0), loaded.length - 1);
  for (let distance = 0; distance < loaded.length; distance++) {
    if (loaded[start - distance]) return start - distance;
    if (loaded[start + distance]) return start + distance;
  }
  return null;
}

export function placeFrame(
  placement: FramePlacement,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): FrameRect {
  if (placement === "cover") {
    const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight);
    const width = srcWidth * scale;
    const height = srcHeight * scale;
    return { x: (dstWidth - width) / 2, y: (dstHeight - height) / 2, width, height };
  }
  const height = srcHeight * (dstWidth / srcWidth);
  return { x: 0, y: dstHeight - height, width: dstWidth, height };
}
