/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--color-base)",
        lightbox: "var(--color-lightbox)",
        normal: "var(--color-normal)",
        attention: "var(--color-attention)",
        critical: "var(--color-critical)",
      },
    },
  },
  plugins: [],
}
