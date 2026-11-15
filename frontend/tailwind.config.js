/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.25rem", screens: { "2xl": "1280px" } },
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"], display: ["Sora", "Inter", "sans-serif"] },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: {
        soft: "0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.10)",
        float: "0 24px 60px -12px rgb(76 29 149 / 0.35), 0 8px 20px -8px rgb(15 23 42 / 0.2)",
      },
      keyframes: {
        bounceDot: { "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.4" }, "40%": { transform: "translateY(-4px)", opacity: "1" } },
        pulseRing: { "0%": { transform: "scale(1)", opacity: "0.5" }, "100%": { transform: "scale(1.9)", opacity: "0" } },
      },
      animation: { bounceDot: "bounceDot 1.2s infinite ease-in-out", pulseRing: "pulseRing 2.2s infinite ease-out" },
    },
  },
  plugins: [],
};
