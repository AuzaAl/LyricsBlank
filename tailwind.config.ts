import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // YouTube Music design system (design.md §1)
        ytm: {
          base: "#030303",
          "surface-1": "#181818",
          "surface-2": "#212121",
          ink: "rgba(255,255,255,0.7)",
          brand: "#f03",
          link: "#3ea6ff",
          frosted: "rgba(15,15,15,0.8)",
        },
        // Legacy monkey tokens kept for modals/compat
        monkey: {
          bg: "#030303",
          panel: "rgba(15, 15, 15, 0.55)",
          sub: "#909090",
          text: "#ffffff",
          main: "#f03", // brand red replaces the old yellow accent
          cyan: "#3ea6ff", // YTM overlay link blue replaces cyan
          green: "#4ade80",
          error: "#ef4444",
        },
      },
      fontFamily: {
        sans: [
          "Roboto",
          '"SF Pro"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Arial",
          "sans-serif",
        ],
      },
      animation: {
        "line-enter": "lineEnter 0.166s ease-out both",
        "caret-blink": "caretBlink 0.9s cubic-bezier(0.23, 1, 0.32, 1) infinite",
        "subtle-shake": "shake 0.3s cubic-bezier(.36,.07,.19,.97) both",
        "fade-in": "fadeIn 0.2s ease-out both",
      },
      keyframes: {
        // Lyric line entrance: scale(0.95) -> 1 (design.md §5)
        lineEnter: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        caretBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        shake: {
          "10%, 90%": { transform: "translate3d(-1px, 0, 0)" },
          "20%, 80%": { transform: "translate3d(2px, 0, 0)" },
          "30%, 50%, 70%": { transform: "translate3d(-3px, 0, 0)" },
          "40%, 60%": { transform: "translate3d(3px, 0, 0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "40px",
        "3xl": "70px",
      },
    },
  },
  plugins: [],
};

export default config;
