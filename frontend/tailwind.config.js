/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0b1120',
        deepslate: '#111827',
        panel: '#1e293b',
        accent: '#0ea5e9',
        'accent-hover': '#0284c7',
        amber: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          light: '#fbbf24',
          dark: '#b45309',
          muted: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.25)',
          '400': '#fbbf24',
          '500': '#f59e0b',
          '300': '#fcd34d',
        },
        danger: '#f87171',
        success: '#34d399',
        muted: '#94a3b8',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 16px rgba(14, 165, 233, 0.10)',
        'glow-lg': '0 0 28px rgba(14, 165, 233, 0.16)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
