/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--c-surface) / <alpha-value>)",
          2: "rgb(var(--c-surface-2) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--c-line) / <alpha-value>)",
          strong: "rgb(var(--c-line-strong) / <alpha-value>)",
        },
        overlay: "var(--c-overlay)",
        ok: {
          DEFAULT: "rgb(var(--c-ok) / <alpha-value>)",
          soft: "rgb(var(--c-ok-soft) / <alpha-value>)",
          line: "rgb(var(--c-ok-line) / <alpha-value>)",
          solid: "rgb(var(--c-ok-solid) / <alpha-value>)",
        },
        warn: {
          DEFAULT: "rgb(var(--c-warn) / <alpha-value>)",
          soft: "rgb(var(--c-warn-soft) / <alpha-value>)",
          line: "rgb(var(--c-warn-line) / <alpha-value>)",
          solid: "rgb(var(--c-warn-solid) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--c-danger) / <alpha-value>)",
          soft: "rgb(var(--c-danger-soft) / <alpha-value>)",
          line: "rgb(var(--c-danger-line) / <alpha-value>)",
          solid: "rgb(var(--c-danger-solid) / <alpha-value>)",
        },
      },
      boxShadow: {
        soft: "var(--sh-soft)",
        "soft-lg": "var(--sh-soft-lg)",
      },
    },
  },
};
