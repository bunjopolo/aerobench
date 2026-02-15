/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'xxs': ['11px', '16px'],
      },
      colors: {
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          input: '#0f172a',
        },
        brand: {
          primary: '#6366f1',
          accent: '#818cf8',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
