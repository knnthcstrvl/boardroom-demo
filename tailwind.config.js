import defaultTheme from "tailwindcss/defaultTheme.js"

export default {
  darkMode: "class",
  content: [
    "./resources/**/*.blade.php",
    "./resources/**/*.js",
    "./resources/**/*.jsx",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          primary: "#5c297c",
          secondary: "#ffb736",
          calmBlue: "#4AA3B6",
          flameRed: "#E53935",
          freshGreen: "#9CCB3B",
          stone: "#5A7078",
        },
      },
    },
  },
  plugins: [],
}
