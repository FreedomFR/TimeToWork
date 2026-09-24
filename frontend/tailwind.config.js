/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#161a23",
        sidebarHover: "#232936",
        bg: "#12151d",
        surface: "#1b202b",
        surfaceAlt: "#232936",
        border: "#2a3040",
        muted: "#8b93a7",
        accent: "#2f7dfa",
        accentDark: "#1f63d6",
      },
    },
  },
  plugins: [],
};
