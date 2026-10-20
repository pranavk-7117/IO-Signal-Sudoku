/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          900: '#0B132B', // Deep navy sidebar
          800: '#1C2541', // Dark slate navy
          700: '#273549',
          600: '#3A506B',
          500: '#4F6D7A',
          100: '#E2E8F0',
          50: '#F8FAFC',
        },
        electric: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#0284C7',
          700: '#0066FF',
          800: '#0052CC',
        },
        status: {
          valid: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          pending: '#64748B',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
