import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Cairo", "sans-serif"] },
      colors: {
        // ألوان هوية مؤسسة غيث: الأخضر الغامق بتاع خلفية اللوجو والأخضر الفسفوري بتاع الخط
        bg: "#F4F8F5",
        surface: "#FFFFFF",
        "surface-alt": "#E8F1EB",
        ink: "#12261D",
        "ink-soft": "#53655B",
        primary: { DEFAULT: "#0F4A37", dark: "#0B3226", tint: "#DDF3E6" },
        brand: { DEFAULT: "#2FF77A", soft: "#C9FBDB" },
        accent: { DEFAULT: "#C68A3E", tint: "#F7EBD8" },
        water: { DEFAULT: "#4C7EA8", tint: "#E6EEF5" },
        danger: { DEFAULT: "#B5493B", tint: "#F7E7E3" },
        good: { DEFAULT: "#3E7A4E", tint: "#E5F1E7" },
        line: "#D5E3DA",
      },
      borderRadius: { card: "10px" },
      boxShadow: { card: "0 1px 2px rgba(15,74,55,.06), 0 4px 14px rgba(15,74,55,.05)" },
    },
  },
  plugins: [],
} satisfies Config;
