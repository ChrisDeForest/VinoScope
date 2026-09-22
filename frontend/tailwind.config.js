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
        "surface-border": "var(--color-surface-border)",
        ink: "var(--color-ink)",
        "ink-muted": "var(--color-ink-muted)",
        accent: "var(--color-accent)",
      },
    },
  },
  plugins: [],
};
