/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#FAFAFA',
          sidebar: '#F4F4F5',
          card: '#FFFFFF',
          border: '#E4E4E7',
          borderLight: '#F1F1F4',
          text: '#09090B',
          muted: '#71717A',
          subtle: '#A1A1AA',
          accent: '#18181B',
          accentHover: '#27272A',
          highlight: '#2563EB',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Newsreader"', '"Instrument Serif"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace']
      }
    },
  },
  plugins: [],
}
