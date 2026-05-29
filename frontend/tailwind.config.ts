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
        forta: {
          primary: "#0891B2",
          "primary-hover": "#0E7490",
          "primary-soft": "#ECFEFF",
          "primary-dark": "#164E63",
          accent: "#6B1D3A",
          "accent-soft": "#FDF2F6",
          surface: "#FFFFFF",
          muted: "#F0F5F7",
          border: "#D9E6EC",
          success: "#059669",
          warning: "#D97706",
          danger: "#DC2626",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 45, 61, 0.04), 0 4px 16px rgba(8, 145, 178, 0.06)",
        "card-hover": "0 4px 24px rgba(8, 145, 178, 0.12)",
        sidebar: "4px 0 24px rgba(15, 45, 61, 0.06)",
      },
      backgroundImage: {
        "page-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(8, 145, 178, 0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(107, 29, 58, 0.04), transparent)",
      },
    },
  },
  plugins: [],
};
export default config;
