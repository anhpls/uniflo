import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        geist: "var(--font-geist-sans)",
        geistMono: "var(--font-geist-mono)",
        dmSans: "var(--font-dm-sans)", // Register DM Sans in Tailwind
      },
    },
  },
  plugins: [],
} satisfies Config;
