import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        success: { 500: '#22c55e', 100: '#dcfce7' },
        warning: { 500: '#f59e0b', 100: '#fef3c7' },
        danger:  { 500: '#ef4444', 100: '#fee2e2' },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['D2Coding', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
