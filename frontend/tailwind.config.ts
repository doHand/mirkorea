import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef4f0',
          100: '#fee5db',
          200: '#fcc9b5',
          300: '#f9a285',
          400: '#f47050',
          500: '#e84c2b',
          600: '#d23918',
          700: '#ad2e13',
          800: '#8a2511',
          900: '#6b1c0c',
        },
        warm: {
          50:  '#fefdfb',
          100: '#faf7f2',
          200: '#f5efe6',
          300: '#ede5d8',
          400: '#ddd0be',
          500: '#c9b99e',
        },
        success: { 500: '#22c55e', 100: '#dcfce7' },
        warning: { 500: '#f59e0b', 100: '#fef3c7' },
        danger:  { 500: '#ef4444', 100: '#fee2e2' },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['D2Coding', 'Consolas', 'monospace'],
      },
      keyframes: {
        scanLine: {
          '0%, 100%': { top: '4px' },
          '50%':       { top: 'calc(100% - 6px)' },
        },
      },
      animation: {
        'scan-line': 'scanLine 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
