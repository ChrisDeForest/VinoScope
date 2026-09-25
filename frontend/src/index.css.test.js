// @vitest-environment node

import { resolve } from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";

describe("global stylesheet", () => {
  it("preserves all theme variables in the production CSS output", async () => {
    const root = process.cwd();
    const result = await build({
      configFile: false,
      root,
      build: {
        write: false,
        rollupOptions: {
          input: resolve(root, "src/index.css"),
        },
      },
    });

    const output = Array.isArray(result) ? result.flatMap((bundle) => bundle.output) : result.output;
    const cssAsset = output.find(
      (entry) => entry.type === "asset" && entry.fileName.endsWith(".css") && typeof entry.source === "string"
    );
    expect(cssAsset).toBeDefined();

    const css = cssAsset?.type === "asset" && typeof cssAsset.source === "string" ? cssAsset.source : "";
    for (const theme of ["dark-burgundy", "cream-terracotta", "charcoal-gold"]) {
      expect(css).toMatch(new RegExp(`\\[data-theme=["']?${theme}["']?\\]`));
    }
    for (const variable of [
      "--color-surface",
      "--color-surface-raised",
      "--color-surface-border",
      "--color-ink",
      "--color-ink-muted",
      "--color-accent",
      "--color-wine-red",
      "--color-wine-white",
      "--color-wine-rose",
      "--color-cellar-bg",
      "--color-cellar-ink",
      "--color-cellar-muted",
    ]) {
      expect(css).toMatch(new RegExp(`${variable}\\s*:`));
    }
  });
});
