import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0b0812",
        ink: "#120d1d",
        surface: "#181226",
        edge: "#2a2140",
        blush: "#ff2d78",
        violet: "#8b5cf6",
        gold: "#f5c451",
        mist: "#b8aecf",
      },
      backgroundImage: {
        "exotic": "linear-gradient(135deg, #ff2d78 0%, #8b5cf6 100%)",
        "exotic-soft": "linear-gradient(135deg, rgba(255,45,120,0.14) 0%, rgba(139,92,246,0.14) 100%)",
      },
      boxShadow: {
        glow: "0 0 40px rgba(255, 45, 120, 0.25)",
        "glow-violet": "0 0 40px rgba(139, 92, 246, 0.25)",
        soft: "0 8px 30px rgba(0,0,0,0.45)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
