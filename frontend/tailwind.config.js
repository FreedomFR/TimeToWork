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
      // Entrance effects. Every one-off keyframe only has a `from` step: the element then ends on its normal
      // style, so switching animations off (see index.css) needs no special case anywhere. (The two
      // endless ones, pulse-ring and clock-hand, simply stop.)
      keyframes: {
        "fade-in": { from: { opacity: "0" } },
        "page-in": { from: { opacity: "0", transform: "translateY(8px)" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(-4px) scale(0.97)" } },
        "dialog-in": { from: { opacity: "0", transform: "translateY(10px) scale(0.97)" } },
        "grow-y": { from: { transform: "scaleY(0)" } },
        "draw-arc": { from: { strokeDasharray: "0 var(--arc-length)" } },
        "clock-hand": { to: { transform: "rotate(360deg)" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.55)" },
          "70%, 100%": { boxShadow: "0 0 0 10px rgba(239, 68, 68, 0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out backwards",
        "page-in": "page-in 0.25s ease-out backwards",
        "pop-in": "pop-in 0.14s ease-out backwards",
        "dialog-in": "dialog-in 0.18s ease-out backwards",
        "grow-y": "grow-y 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards",
        "draw-arc": "draw-arc 0.7s ease-out backwards",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        "clock-hand": "clock-hand 2s linear infinite",
      },
    },
  },
  plugins: [],
};
