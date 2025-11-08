/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-jetbrains-mono)'],
      },
      colors: {
        midnight: {
          50: '#EEF0FF',
          100: '#D6DAFF',
          200: '#B0B9FF',
          300: '#7D8AFF',
          400: '#4A5BFF',
          500: '#2447FF',
          600: '#1B32C9',
          700: '#132396',
          800: '#0B165F',
          900: '#040720',
          950: '#020316',
        },
        electricPink: '#FF2D95',
        aurora: '#36E0FF',
      },
      boxShadow: {
        glow: '0 10px 40px rgba(255, 45, 149, 0.35)',
        midnight: '0 20px 60px rgba(4, 7, 32, 0.45)',
      },
      backgroundImage: {
        'grid-glow': 'radial-gradient(circle at 20% 20%, rgba(255,45,149,0.18) 0, rgba(4,7,32,0) 45%), radial-gradient(circle at 80% -10%, rgba(36,71,255,0.2) 0, rgba(4,7,32,0) 50%)',
      },
    },
  },
  plugins: [],
};