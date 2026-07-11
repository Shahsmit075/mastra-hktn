/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['var(--font-ui)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        sans: ['var(--font-ui)', 'sans-serif'], // fallback for standard usage
      },
      colors: {
        background: 'var(--bg-base)', // Map Tailwind's default background to bg-base
        foreground: 'var(--text-primary)', // Map Tailwind's default text to text-primary
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        sunken: 'var(--bg-sunken)',
        border: {
          DEFAULT: 'var(--border-hairline)',
          hairline: 'var(--border-hairline)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          'on-accent': 'var(--text-on-accent)',
        },
        muted: {
          DEFAULT: 'var(--text-muted)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          muted: 'var(--accent-muted)',
        },
        info: {
          DEFAULT: 'var(--info)',
          muted: 'var(--info-muted)',
        },
        critical: {
          DEFAULT: 'var(--sev1-critical)',
          muted: 'var(--sev1-muted)',
        },
        warning: {
          DEFAULT: 'var(--sev2-warning)',
          muted: 'var(--sev2-muted)',
        },
        healthy: {
          DEFAULT: 'var(--healthy)',
          muted: 'var(--healthy-muted)',
        },
        neutral: 'var(--neutral)',
      },
      boxShadow: {
        elevated: 'var(--shadow-elevated)',
      },
    },
  },
  plugins: [],
};
