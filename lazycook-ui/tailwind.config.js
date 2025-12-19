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
        // Dark mode colors
        dark: {
          bg: '#0b0b0f',
          surface: '#12121a',
          'surface-2': '#171722',
          border: 'rgba(255, 255, 255, 0.08)',
          text: 'rgba(255, 255, 255, 0.92)',
          'text-muted': 'rgba(255, 255, 255, 0.6)',
          accent: '#ffffff',
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

