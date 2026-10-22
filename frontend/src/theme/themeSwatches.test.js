// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_OPTIONS } from "./useTheme";

// Read from disk: Vitest doesn't process CSS, so a `?raw` import of it comes back empty.
const themesCss = readFileSync(resolve(process.cwd(), "src/theme/themes.css"), "utf8");

function themeVariable(theme, name) {
  const block = themesCss.slice(themesCss.indexOf(`[data-theme="${theme}"]`));
  const match = block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  return match ? match[1].toLowerCase() : "";
}

describe("theme picker swatches", () => {
  it("match each theme's own background, accent and text colors in themes.css", () => {
    for (const option of THEME_OPTIONS) {
      expect(option.swatch).toEqual({
        surface: themeVariable(option.value, "surface"),
        accent: themeVariable(option.value, "accent"),
        ink: themeVariable(option.value, "ink"),
        muted: themeVariable(option.value, "ink-muted"),
      });
    }
  });
});
