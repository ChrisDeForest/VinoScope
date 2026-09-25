/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
      },
      colors: {
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        "image-panel": "var(--color-image-panel)",
        "surface-border": "var(--color-surface-border)",
        ink: "var(--color-ink)",
        "ink-muted": "var(--color-ink-muted)",
        accent: "var(--color-accent)",
        "wine-red": "var(--color-wine-red)",
        "wine-white": "var(--color-wine-white)",
        "wine-rose": "var(--color-wine-rose)",
        "cellar-bg": "var(--color-cellar-bg)",
        "cellar-ink": "var(--color-cellar-ink)",
        "cellar-muted": "var(--color-cellar-muted)",
      },
    },
  },
  plugins: [],
};
