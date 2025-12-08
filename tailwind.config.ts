import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        // Nano Banana - High-vibrancy organic-tech palette
        banana: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          glow: '#facc15',
          electric: '#f7e020',
        },
        nano: {
          green: '#39ff14',       // Neon green
          lime: '#84cc16',        // Bio lime
          cyan: '#22d3ee',        // Electric cyan
          mint: '#4ade80',        // Mint glow
          glow: '#39ff14',        // Primary glow
        },
        brutalist: {
          black: '#0a0a0a',
          white: '#fafafa',
          accent: '#ff3366',      // Hot pink accent
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg, 0.75rem)',
        md: 'var(--radius-md, 0.5rem)',
        sm: 'var(--radius-sm, 0.375rem)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'nano-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(57, 255, 20, 0.4), 0 0 10px rgba(57, 255, 20, 0.2)',
            borderColor: 'rgba(57, 255, 20, 0.5)',
          },
          '50%': {
            boxShadow: '0 0 15px rgba(57, 255, 20, 0.6), 0 0 25px rgba(57, 255, 20, 0.3)',
            borderColor: 'rgba(57, 255, 20, 0.8)',
          },
        },
        'banana-glow': {
          '0%, 100%': {
            textShadow: '0 0 10px rgba(250, 204, 21, 0.5)',
          },
          '50%': {
            textShadow: '0 0 20px rgba(250, 204, 21, 0.8), 0 0 30px rgba(250, 204, 21, 0.4)',
          },
        },
        'data-scan': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'nano-pulse': 'nano-pulse 2s ease-in-out infinite',
        'banana-glow': 'banana-glow 3s ease-in-out infinite',
        'data-scan': 'data-scan 3s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config

