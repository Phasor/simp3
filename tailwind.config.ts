import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          500: '#6366f1',
          600: '#5B3EFF',
          700: '#4a32cc',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        brand: {
          DEFAULT: '#2563EB',
          600: '#2563EB',
          700: '#1D4ED8'
        },
        text: {
          primary: 'rgba(255,255,255,0.98)',
          secondary: 'rgba(255,255,255,0.80)',
          muted: 'rgba(255,255,255,0.65)',
          subtle: 'rgba(255,255,255,0.55)',
          inverse: '#111827',
          accent: '#0ea5e9',
          success: '#34d399',
          danger: '#f87171',
        },
        gold: {
          DEFAULT: '#C9A84C',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      fontSize: {
        display: ['clamp(2rem, 3vw + 1rem, 3rem)', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        h1: ['clamp(1.75rem, 2.5vw + 0.75rem, 2.25rem)', { lineHeight: '1.2' }],
        h2: ['clamp(1.5rem, 1.6vw + 0.8rem, 1.875rem)', { lineHeight: '1.25' }],
        h3: ['clamp(1.25rem, 1.2vw + 0.6rem, 1.5rem)', { lineHeight: '1.3' }],
        'body-lg': ['1.125rem', { lineHeight: '1.65' }],
        body: ['1rem', { lineHeight: '1.65' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.6' }],
        ui: ['0.9375rem', { lineHeight: '1.4', letterSpacing: '0.005em' }],
        label: ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        caption: ['0.8125rem', { lineHeight: '1.35' }],
        overline: ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.08em', textTransform: 'uppercase' } as any],
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      boxShadow: {
        soft: '0 4px 24px rgba(0,0,0,0.06)',
      },
      animation: {
        'gold-pulse': 'gold-pulse 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s ease both',
      },
      keyframes: {
        'gold-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0)' },
          '50%': { boxShadow: '0 0 24px 4px rgba(201,168,76,0.4)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
