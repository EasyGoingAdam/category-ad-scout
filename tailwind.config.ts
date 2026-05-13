import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme palette.
        bg: '#fafaf9',        // page background (warm off-white, stone-50)
        panel: '#ffffff',     // card surface
        line: '#e7e5e4',      // borders (stone-200)
        ink: '#1c1917',       // primary text (stone-900)
        muted: '#78716c',     // secondary text (stone-500)
        accent: '#ea580c',    // brand orange (orange-600 — readable on white)
        'accent-soft': '#fff7ed', // orange-50 — hover/highlight surfaces
      },
    },
  },
  plugins: [],
};
export default config;
