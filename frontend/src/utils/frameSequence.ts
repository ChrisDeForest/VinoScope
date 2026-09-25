export type FrameSet = "desktop" | "mobile";
export type FramePlacement = "cover" | "fit-width-bottom";

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HERO_FRAME_COUNT = 64;
export const MOBILE_MAX_WIDTH = 768;

export function frameSetForWidth(width: number): FrameSet {
  return width > MOBILE_MAX_WIDTH ? "desktop" : "mobile";
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
