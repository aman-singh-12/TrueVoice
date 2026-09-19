/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f3f5f8',
        sidebar: '#0b1220',
        line: '#e2e6ee',
        ink: '#0f172a',
        mute: '#64748b',
        brand: {
          DEFAULT: '#0e7490',
          hover: '#155e75',
        },
        low: '#047857',
        mod: '#b45309',
        high: '#c2410c',
        crit: '#be123c',
        warm: {
          canvas: '#FBFBFA',
          subtle: '#F4F4F0',
          card: '#FFFFFF',
          border: '#EAEAE5',
          borderSubtle: '#E2E2DC',
          well: '#F7F7F4',
          wellBorder: '#E4E4DF',
          mutedBar: '#D4D4D0',
        },
        inkLegacy: {
          primary: '#18181B',
          secondary: '#71717A',
          muted: '#52525B',
          subtle: '#A1A1AA',
        },
        terracotta: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
      },
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgba(24, 24, 27, 0.04)',
        'soft': '0 1px 3px 0 rgba(24, 24, 27, 0.04), 0 1px 2px -1px rgba(24, 24, 27, 0.02)',
        'soft-md': '0 4px 12px -2px rgba(24, 24, 27, 0.06), 0 2px 6px -1px rgba(24, 24, 27, 0.03)',
        'soft-lg': '0 10px 25px -3px rgba(24, 24, 27, 0.08), 0 4px 10px -2px rgba(24, 24, 27, 0.04)',
        'glow-terracotta': '0 0 20px -3px rgba(234, 88, 12, 0.25)',
      },
    },
  },
  plugins: [],
}
