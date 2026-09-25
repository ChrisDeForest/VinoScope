import type { CSSProperties } from "react";

// React's CSSProperties has no index signature for custom properties.
export function cssVars(vars: Record<`--${string}`, string>): CSSProperties {
  return vars as CSSProperties;
}
