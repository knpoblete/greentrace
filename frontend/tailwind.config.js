/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0f1e',
        surface: '#111827',
        surface2: '#1a2233',
        border: '#1f2937',
        compliant: '#10b981',
        atrisk: '#f59e0b',
        breach: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
