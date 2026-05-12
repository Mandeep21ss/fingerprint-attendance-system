/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        'primary': '#6366f1',
        'primary-light': '#818cf8',
        'primary-dark': '#4f46e5',
        
        // Dark theme
        'dark-bg': '#0a0e1a',
        'dark-secondary': '#111827',
        'dark-card': 'rgba(17, 24, 39, 0.7)',
        
        // Accent colors
        'accent-emerald': '#10b981',
        'accent-amber': '#f59e0b',
        'accent-rose': '#f43f5e',
        'accent-cyan': '#06b6d4',
        
        // Text colors
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
      },
      backgroundColor: {
        'glass': 'rgba(255, 255, 255, 0.04)',
        'glass-hover': 'rgba(255, 255, 255, 0.08)',
      },
      borderColor: {
        'glass': 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        sans: ["'Inter'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.1)',
        'glow-indigo': '0 0 20px rgba(99, 102, 241, 0.3)',
      },
      animation: {
        'pulse-anim': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-anim': 'spin 1s linear infinite',
        'fadeIn': 'fadeIn 150ms ease',
        'slideUp': 'slideUp 250ms ease',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
};
