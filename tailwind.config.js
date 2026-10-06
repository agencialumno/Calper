/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        calper: {
          red: '#dd0417',
          'red-dark': '#b80311',
          dark: '#282e35'
        }
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif']
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px'
      }
    }
  },
  plugins: []
};
