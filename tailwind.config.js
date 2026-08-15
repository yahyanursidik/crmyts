/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: {
          50: '#f3f8f3',
          100: '#e4f1e5',
          200: '#cde4ce',
          300: '#a3cba5',
          400: '#78aa7a',
          500: '#558c58',
          600: '#447346', // Logo Tarbiyah Primary Green
          700: '#365e38',
          800: '#28482a',
          900: '#1c321d', // Logo Deep Forest Typography
          950: '#122013', // Deepest Brand Background
        },
        amber: {
          50: '#fff9f2',
          100: '#fef0dc',
          200: '#fde0b7',
          300: '#fac37f',
          400: '#f3a24a',
          500: '#e88523',
          600: '#d87114', // Logo Middle Terracotta Ray
          700: '#c05c0f',
          800: '#9f490a',
          900: '#7a3806',
          950: '#461c02',
        },
        gold: {
          50: '#fffcf0',
          100: '#fef6d8',
          200: '#fdebaf',
          300: '#fad779',
          400: '#f7c244',
          500: '#efa914', // Logo Top Golden Ray
          600: '#dc9e10',
          700: '#bb820a',
          800: '#966506',
          900: '#734c03',
          950: '#452a01',
        },
        cream: {
          50: '#fdfcf9',
          100: '#fbfaf6', // Logo Background Warm Ivory
          200: '#f7f5ed',
          300: '#efece0',
          400: '#dfdac7',
          500: '#c7c0a8',
          600: '#a8a087',
          700: '#89816b',
          800: '#6c6553',
          900: '#4f4a3c',
          950: '#2d2a21',
        },
        surface: {
          50: '#fbfaf6',
          100: '#f7f5ed',
          200: '#e8e5d8',
          300: '#d5d1c1',
          400: '#9e9988',
          500: '#6b6657',
          600: '#4f4b3e',
          700: '#38352b',
          800: '#23211b',
          900: '#151410',
          950: '#0a0907',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.025em',
        tighter: '-0.015em',
      },
    },
  },
  plugins: [],
}
