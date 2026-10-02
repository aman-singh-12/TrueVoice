/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#090d16',
        panel: {
          DEFAULT: '#0f172a',
          elevated: '#141d33',
          subtle: '#0c1322',
        },
        border: {
          DEFAULT: '#1e293b',
          subtle: 'rgba(255, 255, 255, 0.07)',
          glow: 'rgba(56, 189, 248, 0.2)',
        },
        line: '#1e293b',
        ink: {
          DEFAULT: '#f8fafc',
          muted: '#94a3b8',
          subtle: '#64748b',
          faint: '#475569',
        },
        brand: {
          DEFAULT: '#0284c7',
          hover: '#0369a1',
          light: '#38bdf8',
          glow: 'rgba(56, 189, 248, 0.2)',
        },
        low: '#10b981',
        mod: '#f59e0b',
        high: '#f97316',
        crit: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'soc': '0 4px 24px -1px rgba(0, 0, 0, 0.55)',
        'soc-card': '0 2px 12px -1px rgba(0, 0, 0, 0.4)',
        'glow-cyan': '0 0 24px -2px rgba(14, 165, 233, 0.25)',
        'glow-crit': '0 0 24px -2px rgba(239, 68, 68, 0.28)',
        'glow-low': '0 0 24px -2px rgba(16, 185, 129, 0.25)',
      },
    },
  },
  plugins: [],
}
