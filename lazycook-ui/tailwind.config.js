/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode colors
        light: {
          bg: '#ffffff',
          surface: '#f9fafb',
          border: '#e5e7eb',
          text: '#111827',
          'text-muted': '#6b7280',
          accent: '#3b82f6',
        },
        // Dark mode colors - Darker, Clearer VS Code Dark+ Inspired
        dark: {
          bg: '#0d0d0d',
          surface: '#1a1a1a',
          'surface-2': '#222222',
          border: 'rgba(255, 255, 255, 0.18)',
          text: '#e8e8e8',
          'text-muted': '#9a9a9a',
          accent: '#4a9eff',
          'accent-secondary': '#3dd5c4',
        },
      },
      borderRadius: {
        '2xl': '1rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

