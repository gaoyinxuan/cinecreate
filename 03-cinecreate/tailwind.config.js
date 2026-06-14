/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          300: '#E8CC8A',
          400: '#D6B36A',
          500: '#C49A3C',
          600: '#B38A2E',
        }
      }
    }
  },
  plugins: [],
};
