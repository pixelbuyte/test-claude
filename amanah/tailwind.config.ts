import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#faf6ee",
        parchment: "#f3ecdd",
        emerald: {
          950: "#06231b",
          900: "#0b3d2e",
          800: "#11543f",
          700: "#186a50",
        },
        gold: {
          400: "#d9b64a",
          500: "#c9a227",
          600: "#a8871f",
        },
        ink: "#1d1c17",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Helvetica Neue", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(29,28,23,0.06), 0 8px 24px -12px rgba(11,61,46,0.18)",
        lift: "0 2px 4px rgba(29,28,23,0.08), 0 16px 40px -16px rgba(11,61,46,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
