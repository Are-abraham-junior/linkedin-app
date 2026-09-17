/** @type {import('tailwindcss').Config} */
const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens sémantiques (valeurs dans src/index.css :root)
        ink: rgb("--ink"),
        "ink-2": rgb("--ink-2"),
        muted: rgb("--muted"),
        "muted-2": rgb("--muted-2"),
        line: rgb("--line"),
        "line-2": rgb("--line-2"),
        surface: rgb("--surface"),
        "surface-2": rgb("--surface-2"),
        canvas: rgb("--canvas"),
        accent: {
          DEFAULT: rgb("--accent"),
          hover: rgb("--accent-hover"),
          active: rgb("--accent-active"),
          soft: rgb("--accent-soft"),
        },
        ok: { DEFAULT: rgb("--ok"), soft: rgb("--ok-soft") },
        warn: { DEFAULT: rgb("--warn"), soft: rgb("--warn-soft") },
        danger: {
          DEFAULT: rgb("--danger"),
          soft: rgb("--danger-soft"),
          line: rgb("--danger-line"),
          hover: rgb("--danger-hover"),
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        display: ["'General Sans'", "'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
      },
      borderRadius: {
        // utilisés par le site vitrine uniquement
        card: "32px",
        shot: "24px",
      },
      maxWidth: {
        site: "1200px",
        prose: "65ch",
      },
      boxShadow: {
        // Seule ombre autorisée dans l'app : popovers, modales, toasts.
        pop: "0 8px 24px rgba(33, 22, 76, 0.08)",
      },
    },
  },
  plugins: [],
};
