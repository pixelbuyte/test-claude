import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f0ff",
          100: "#e6e1ff",
          200: "#c6baff",
          300: "#a593ff",
          400: "#8a6bff",
          500: "#7c4dff",
          600: "#6b2fff",
          700: "#5a1fe0",
          800: "#4718b0",
          900: "#331488",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      keyframes: {
        pulseglow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseglow: "pulseglow 2s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        rise: "rise 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
