import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        edge: "var(--edge)",
        "edge-hot": "var(--edge-hot)",
        acid: "var(--acid)",
        "acid-dim": "var(--acid-dim)",
        hot: "var(--hot)",
        ice: "var(--ice)",
        bone: "var(--bone)",
        ash: "var(--ash)",
        dust: "var(--dust)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        crush: "-0.03em",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
      },
      animation: {
        blink: "blink 1.1s steps(2, end) infinite",
      },
    },
  },
  plugins: [],
};
export default config;
