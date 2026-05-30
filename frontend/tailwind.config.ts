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
          primary:        "#6B1D3A",
          "primary-hover":"#8B2650",
          "primary-soft": "#FDF2F6",
          "primary-dark": "#3C0A18",
          accent:         "#C06080",
          "accent-soft":  "#FBE8EF",
          surface:        "#FFFFFF",
          muted:          "#F7F0F3",
          border:         "#E8D0DA",
          success:        "#166534",
          "success-soft": "#DCFCE7",
          warning:        "#92400E",
          "warning-soft": "#FEF3C7",
          danger:         "#991B1B",
          "danger-soft":  "#FEE2E2",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        body:    ["var(--font-body)",    "system-ui", "sans-serif"],
      },
      boxShadow: {
        card:       "0 1px 2px rgba(60,10,24,0.04), 0 4px 16px rgba(107,29,58,0.07)",
        "card-hover":"0 4px 24px rgba(107,29,58,0.14)",
        sidebar:    "4px 0 24px rgba(60,10,24,0.08)",
      },
      backgroundImage: {
        "page-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(107,29,58,0.06), transparent), " +
          "radial-gradient(ellipse 60% 40% at 100% 0%, rgba(192,96,128,0.04), transparent)",
      },
    },
  },
  plugins: [],
};
export default config;
