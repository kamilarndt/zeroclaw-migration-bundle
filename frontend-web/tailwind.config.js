/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderColor: theme => ({
        DEFAULT: theme('colors.neutral.200', 'currentColor'),
        ...theme('colors'),
      }),
      colors: {
        slate: {
          850: '#151e2e',
          900: '#0f172a',
          950: '#020617'
        },
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#3F3F46',
          800: '#27272A',
          850: '#18181B',
          900: '#121212',
          950: '#0A0A0A'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'dashflow': 'dashflow 1.5s ease-in-out infinite'
      },
      keyframes: {
        dashflow: {
          '0%': { strokeDashoffset: '1000', strokeDasharray: '1000' },
          '50%': { strokeDashoffset: '0', strokeDasharray: '1000' },
          '100%': { strokeDashoffset: '-1000', strokeDasharray: '1000' }
        }
      },
      spacing: {
        '18': '4.5rem',
        '128': '32rem'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}
