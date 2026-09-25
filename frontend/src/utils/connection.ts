interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);

// True when the visitor has asked for less data (data-saver mode) or is on a
// connection too slow to comfortably stream 64 frames of full-motion video.
// `navigator.connection` (Network Information API) is Chromium-only; when
// it's absent we assume a normal connection rather than degrade everyone.
export function prefersLightweightMedia(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) return false;
  if (connection.saveData === true) return true;
  return connection.effectiveType !== undefined && SLOW_EFFECTIVE_TYPES.has(connection.effectiveType);
}
