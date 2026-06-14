/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          300: '#9DA3FA',
          400: '#6F78F6',
          500: '#5E68F0',
          600: '#4A54E0',
        }
      }
    }
  },
  plugins: [],
};
