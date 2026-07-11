/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: 'var(--surface)',
        amber: {
          DEFAULT: 'var(--amber)',
          muted: 'var(--amber-muted)',
        },
        critical: 'var(--critical)',
        high: 'var(--high)',
        medium: 'var(--medium)',
        low: 'var(--low)',
      },
    },
  },
  plugins: [],
};
