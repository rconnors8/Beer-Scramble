import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0F0D',
        surface: {
          DEFAULT: '#121A17',
          2: '#18221E',
        },
        ink: {
          DEFAULT: '#EAF2EE',
          dim: '#95A9A0',
          faint: '#5E7268',
        },
        mint: {
          DEFAULT: '#45E3A0',
          deep: '#17B577',
          ink: '#04140D',
        },
        amber: {
          DEFAULT: '#F5B93C',
          deep: '#DF9A1C',
          ink: '#2A1D02',
        },
        coral: '#FF6B5E',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6)',
        glow: '0 8px 30px -8px rgba(69,227,160,0.45)',
        'glow-amber': '0 8px 30px -8px rgba(245,185,60,0.45)',
      },
      backgroundImage: {
        'top-glow':
          'radial-gradient(120% 80% at 50% -10%, rgba(69,227,160,0.10) 0%, rgba(10,15,13,0) 55%)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        celebrate: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '18%': { transform: 'scale(1.12)', opacity: '1' },
          '70%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.18s ease-out',
        'sheet-up': 'sheet-up 0.22s cubic-bezier(0.22,1,0.36,1)',
        celebrate: 'celebrate 1.7s ease-out forwards',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
