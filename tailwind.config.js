/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'neon-red': '#ff0a45',
        'neon-magenta': '#ff0080',
        'neon-cyan': '#00ffff',
        'glass-bg': 'rgba(0,0,0,0.35)',
        'glass-border': 'rgba(255,30,80,0.25)',
      },
      borderRadius: {
        'glass': '22px',
      },
      boxShadow: {
        'glass-inner': 'inset 0 0 12px rgba(255,10,60,0.35)',
        'glass-outer': '0 0 22px rgba(255,10,60,0.45)',
      },
    },
  },
  plugins: [],
}
