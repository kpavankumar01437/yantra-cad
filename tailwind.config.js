/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070a0e',
          900: '#0b1016',
          850: '#0f151d',
          800: '#131b24',
          750: '#18222d',
          700: '#1f2a36',
          600: '#2a3845',
          500: '#3b4c5c',
        },
        line: '#22303d',
        accent: { DEFAULT: '#35a7ff', soft: '#123049', dim: '#1d6fa8' },
        warn: '#e0a33a',
        danger: '#ef5f5f',
        ok: '#3fbf8f',
      },
      fontFamily: {
        sans: ['Inter', '"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '3xs': ['9px', '12px'],
        '2xs': ['10px', '14px'],
        xs: ['11px', '15px'],
        sm: ['12px', '17px'],
      },
      spacing: {
        4.5: '18px',
      },
    },
  },
  plugins: [],
};
