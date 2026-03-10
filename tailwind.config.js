/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#007AFF",
        success: "#28a745",
        warning: "#ffc107",
        danger: "#dc3545",
        secondary: "#FF9500",
        tertiary: "#5856D6",
        muted: "#9CA3AF",
        background: "#F2F2F7",
        gray: "#cccccc",
      },
    },
  },
  plugins: [],
};
