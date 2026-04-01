/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Silkscreen"', "monospace"]
      },
      colors: {
        shell: {
          outer: "#3b6b6b",
          inner: "#7ecec8",
          bezel: "#2a4f52",
          screen: "#e8e4d4"
        }
      }
    }
  },
  plugins: []
};
