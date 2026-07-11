import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables so accent color is themeable at runtime.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
          mid: 'rgb(var(--surface-mid) / <alpha-value>)',
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        error: 'rgb(var(--error) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        // Sharp neo-brutalist corners, 8–16px across the scale.
        xl: '0.75rem', // 12px
        '2xl': '0.875rem', // 14px
        '3xl': '1rem', // 16px — cards, input dock, modals
      },
      boxShadow: {
        // Hard offset shadows (0 blur) = brutalist depth, GPU-cheap, never
        // animated. Driven by --shadow / --shadow-alpha so they read correctly
        // in both themes (ink on light, black on dark).
        subtle: '2px 2px 0 0 rgb(var(--shadow) / var(--shadow-alpha))',
        card: '4px 4px 0 0 rgb(var(--shadow) / var(--shadow-alpha))',
      },
      keyframes: {
        // GPU-only: opacity + translate. No blur/box-shadow/size animation.
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'caret-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'caret-blink': 'caret-blink 1s steps(2, start) infinite',
        'bounce-dot': 'bounce-dot 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
