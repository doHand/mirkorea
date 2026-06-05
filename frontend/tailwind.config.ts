import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep Forest Green — primary brand color
        brand: {
          50:  '#f4f8f5',
          100: '#e0ece3',
          200: '#c0d9c8',
          300: '#93bfa1',
          400: '#5f9e78',
          500: '#3a7d55',
          600: '#2D4033',
          700: '#253628',
          800: '#1e2b20',
          900: '#172019',
        },
        // Override indigo → Forest Green so all existing indigo-* classes get brand color
        indigo: {
          50:  '#f4f8f5',
          100: '#e0ece3',
          200: '#c0d9c8',
          300: '#8cb8a0',
          400: '#5f9e78',
          500: '#3a7d55',
          600: '#2D4033',
          700: '#253628',
          800: '#1e2b20',
          900: '#172019',
          950: '#0f1812',
        },
        // Sunset Terracotta — accent/CTA
        accent: {
          50:  '#fdf3ec',
          100: '#fbe4d0',
          200: '#f6c8a0',
          300: '#f0a46a',
          400: '#e8803e',
          500: '#D2691E',
          600: '#be5c18',
          700: '#9e4c14',
          800: '#7e3c10',
          900: '#63300d',
        },
        warm: {
          50:  '#F9F7F2',  // Soft Ivory
          100: '#F2EDE4',
          200: '#E5D3B3',  // Oatmeal Beige
          300: '#D4BF99',
          400: '#C0A77A',
          500: '#A68B5B',
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
