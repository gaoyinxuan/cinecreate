/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          300: '#D4C090',
          400: '#C0A060',
          500: '#A88848',
          600: '#8B6828',
        }
      }
    }
  },
  plugins: [],
};
