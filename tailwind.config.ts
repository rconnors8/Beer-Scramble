import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        turf: {
          50: '#f1f8f2',
          100: '#dcefdf',
          500: '#1f8a63',
          600: '#14624a',
          700: '#0b3d2e',
        },
        beer: {
          400: '#e8b64c',
          500: '#d59f2f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
