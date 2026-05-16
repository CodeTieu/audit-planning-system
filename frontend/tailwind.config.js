/** @type {import('tailwindcss').Config} */
// NOTE: Tailwind v4 uses CSS-based theme configuration via @theme in index.css
// This file is kept for reference. The actual theme is defined in src/index.css.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e3a5f',
          50: '#e8edf4',
          100: '#c5d0e3',
          200: '#9fb0ce',
          300: '#7990b9',
          400: '#5c78aa',
          500: '#3f609b',
          600: '#355490',
          700: '#284580',
          800: '#1e3a5f',
          900: '#0f2240',
        },
        secondary: {
          DEFAULT: '#c9952a',
          50: '#fdf8ee',
          100: '#f9ecd0',
          200: '#f3d9a0',
          300: '#ecc26a',
          400: '#e4aa3f',
          500: '#c9952a',
          600: '#b07e20',
          700: '#8d641a',
          800: '#6e4e18',
          900: '#5a4016',
        },
        success: {
          DEFAULT: '#166534',
          50: '#f0fdf4',
          500: '#22c55e',
          700: '#15803d',
          800: '#166534',
        },
        warning: {
          DEFAULT: '#92400e',
          50: '#fffbeb',
          500: '#f59e0b',
          700: '#b45309',
          800: '#92400e',
        },
        danger: {
          DEFAULT: '#991b1b',
          50: '#fef2f2',
          500: '#ef4444',
          700: '#b91c1c',
          800: '#991b1b',
        },
        sidebar: '#0f2240',
        background: '#f8fafc',
      },
    },
  },
  plugins: [],
}
