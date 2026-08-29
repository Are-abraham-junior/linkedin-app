/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        adora: {
          violet: "#592eff",
          plum: "#21164c",
          charcoal: "#353241",
          smoke: "#5f5f69",
          pearl: "#e0e0db",
          concrete: "#f5f5f7",
          soft: "#f9f9fb",
          cyan: "#2ed6ff",
          lime: "#a2ea13",
          pink: "#ffaae6",
          magenta: "#f843c2",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        display: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "32px",
        pill: "200px",
        frame: "48px",
      },
      boxShadow: {
        subtle: "0 2px 8px rgba(33, 22, 76, 0.04)",
        card: "0 10px 30px rgba(33, 22, 76, 0.05)",
        floating: "0 14px 40px rgba(89, 46, 255, 0.12)",
      },
    },
  },
  plugins: [],
};
