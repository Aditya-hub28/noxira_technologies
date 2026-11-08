/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1120',
          800: '#0F172A',
          700: '#1E293B',
          600: '#334155'
        },
        gold: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309'
        },
        ink: {
          950: '#0B132B',
          900: '#101B3C',
          800: '#1C2541',
          700: '#26325B'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(11, 19, 43, 0.08)',
        'glass-lg': '0 16px 48px rgba(11, 19, 43, 0.12)',
      }
    },
  },
  plugins: [],
}
