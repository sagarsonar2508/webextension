/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          primary: "#25D366",
          secondary: "#128C7E",
          dark: "#075E54",
          light: "#DCF8C6",
          bg: "#ECE5DD",
          chat: "#E4DDD6"
        }
      }
    }
  },
  plugins: []
}
