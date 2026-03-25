/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        ecoGreen: '#28a745',
        sunOrange: '#ff7f00',
        ecoLightGreen: '#a8e6a3',
        sunLightOrange: '#ffcc80',
        deepForest: '#0f3d2e',
        solarFlare: '#ff9b42'
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Source Sans 3"', 'sans-serif']
      },
      backgroundImage: {
        'hero-sunrise': "radial-gradient(circle at top left, rgba(255,127,0,0.35), transparent 55%), radial-gradient(circle at 30% 30%, rgba(40,167,69,0.35), transparent 55%), linear-gradient(135deg, #f7f3e9 0%, #eaf7ed 55%, #fff3e0 100%)"
      },
      boxShadow: {
        glow: '0 20px 40px -20px rgba(255,127,0,0.45)'
      }
    }
  },
  plugins: []
}
