/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noc: {
          bg: '#060911',
          card: '#0c1322',
          panel: '#111b30',
          border: '#1e2d4a',
          hover: '#1a2944',
          cyan: '#00f0ff',
          blue: '#2563eb',
          purple: '#a855f7',
          pink: '#ec4899',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444'
        }
      },
      boxShadow: {
        'noc-cyan': '0 0 15px rgba(0, 240, 255, 0.25)',
        'noc-purple': '0 0 15px rgba(168, 85, 247, 0.25)',
        'noc-red': '0 0 15px rgba(239, 68, 68, 0.3)',
        'noc-card': '0 4px 20px rgba(0, 0, 0, 0.4)'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
