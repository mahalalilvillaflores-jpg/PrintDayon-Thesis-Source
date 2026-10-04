export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F4F7FB',
        'bg-app': '#F4F7FB',
        card: '#FFFFFF',
        popover: '#FFFFFF',
        border: '#D9E2EF',
        primary: {
          DEFAULT: '#1F429B',
          hover: '#153A87',
          dark: '#153A87',
          navy: '#06244A',
          deep: '#153A87',
          light: '#38bdf8',
          50: '#EBF2FF',
          100: '#D6E4FF',
          200: '#ADC8FF',
          300: '#85A9FF',
          400: '#4080FF',
          500: '#1F429B',
          600: '#1F429B',
          700: '#153A87',
          800: '#06244A',
          900: '#06244A',
        },
        secondary: '#14213D',
        accent: {
          DEFAULT: '#F04438',
          logo: '#F04438',
        },
        muted: '#F4F7FB',
        destructive: '#C62828',
        input: '#FFFFFF',
        ring: '#1F429B',
        sidebar: {
          DEFAULT: '#06244A',
          primary: '#1F429B',
          accent: '#F04438',
          border: '#D9E2EF',
        },
        status: {
          success: '#009B6B',
          warning: '#C77700',
          critical: '#C62828',
          closed: '#475569',
        },
        text: {
          primary: '#14213D',
          secondary: '#60728F',
        },
        chart: {
          1: '#1F429B',
          2: '#009B6B',
          3: '#06244A',
          4: '#C77700',
          5: '#153A87',
        },
        navy: {
          DEFAULT: '#06244A',
          light: '#1F429B',
          dark: '#06244A',
          50: '#e8edf5',
          900: '#06244A',
        },
      },
      borderRadius: {
        DEFAULT: '1rem',
        card: '1rem',
        xl: '1rem',
        '2xl': '1rem',
      },
      letterSpacing: {
        normal: '0em',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
