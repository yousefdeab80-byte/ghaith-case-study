import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Cairo", "sans-serif"] },
      colors: {
        bg: "#FAF7EF",
        surface: "#FFFFFF",
        "surface-alt": "#F2ECDD",
        ink: "#22302A",
        "ink-soft": "#5B6660",
        primary: { DEFAULT: "#1F4738", dark: "#132E24", tint: "#E3EEE7" },
        accent: { DEFAULT: "#C68A3E", tint: "#F7EBD8" },
        water: { DEFAULT: "#4C7EA8", tint: "#E6EEF5" },
        danger: { DEFAULT: "#B5493B", tint: "#F7E7E3" },
        good: { DEFAULT: "#3E7A4E", tint: "#E5F1E7" },
        line: "#E4DCC8",
      },
      borderRadius: { card: "10px" },
      boxShadow: { card: "0 1px 2px rgba(31,71,56,.06), 0 4px 14px rgba(31,71,56,.05)" },
    },
  },
  plugins: [],
} satisfies Config;
