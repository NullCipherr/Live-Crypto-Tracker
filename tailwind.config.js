/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: '1.45' }],
        sm: ['var(--text-sm)', { lineHeight: '1.5' }],
        base: ['var(--text-base)', { lineHeight: '1.55' }],
        lg: ['var(--text-lg)', { lineHeight: '1.4' }],
        xl: ['var(--text-xl)', { lineHeight: '1.25' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '1.2' }],
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        nav: 'hsl(var(--nav) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
        positive: 'hsl(var(--positive) / <alpha-value>)',
        negative: 'hsl(var(--negative) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      spacing: {
        'page-pad': 'var(--page-pad)',
        'page-pad-lg': 'var(--page-pad-lg)',
        'card-pad': 'var(--card-pad)',
        'card-pad-lg': 'var(--card-pad-lg)',
        'control-xs': 'var(--control-h-xs)',
        'control-sm': 'var(--control-h-sm)',
        'control-md': 'var(--control-h-md)',
        'control-lg': 'var(--control-h-lg)',
      },
      maxWidth: {
        page: 'var(--page-max-w)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
        overlay: 'var(--shadow-overlay)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
