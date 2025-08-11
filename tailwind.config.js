/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: { // Add Inter font family
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}