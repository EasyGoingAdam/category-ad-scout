import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0d10',
        panel: '#13161b',
        line: '#1f242c',
        muted: '#7a828d',
        accent: '#ff7a45',
      },
    },
  },
  plugins: [],
};
export default config;
