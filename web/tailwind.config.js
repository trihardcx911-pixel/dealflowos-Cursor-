/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      spacing: {
        "dfos-1": "var(--dfos-space-1)",
        "dfos-2": "var(--dfos-space-2)",
        "dfos-3": "var(--dfos-space-3)",
        "dfos-4": "var(--dfos-space-4)",
        "dfos-5": "var(--dfos-space-5)",
        "dfos-6": "var(--dfos-space-6)",
        "dfos-8": "var(--dfos-space-8)",
        "dfos-10": "var(--dfos-space-10)",
        "dfos-12": "var(--dfos-space-12)",
        "dfos-16": "var(--dfos-space-16)",
      },
      borderRadius: {
        "dfos-sm": "var(--dfos-radius-sm)",
        "dfos-md": "var(--dfos-radius-md)",
        "dfos-lg": "var(--dfos-radius-lg)",
        "dfos-xl": "var(--dfos-radius-xl)",
        "dfos-2xl": "var(--dfos-radius-2xl)",
      },
      borderWidth: {
        "dfos-sm": "var(--dfos-border-sm)",
        "dfos-md": "var(--dfos-border-md)",
        "dfos-lg": "var(--dfos-border-lg)",
      },
    },
  },
  plugins: [],
};
