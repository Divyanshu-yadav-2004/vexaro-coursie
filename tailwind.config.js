/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0F172A',       // Primary component surface color
          navyLight: '#1E293B',  // Lighter navy for cards/hovers
          navyDark: '#020617',   // Darkest background
          orange: '#FF6B00',     // Logistics orange for buttons/active indicators
          orangeHover: '#E05E00',// Hover orange
          grayLight: '#E8EBF7',  // Soft lavender/blue-gray header band background
          grayText: '#64748B',   // Muted gray text
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}
