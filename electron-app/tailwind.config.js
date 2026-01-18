/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./renderer/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#D4AF37',
          500: '#D4AF37',
          600: '#B8941F',
          700: '#9A7A1A',
        },
      },
    },
  },
  plugins: [],
}
