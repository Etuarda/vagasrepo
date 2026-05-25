/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F5F2",
        ink: "#12100E",
        graphite: "#ffffff",
        taupe: "#3F3A36",
        stone: "#514A44",
        borderLight: "#756D66",
        accessible: { yellow: "#FFFF00", blue: "#00FFFF", red: "#FF0000" },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "serif"],
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
      },
      borderRadius: { xl: "1rem", "2xl": "1.5rem", "3xl": "2rem" },
    },
  },
};
