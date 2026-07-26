/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#fdfbf7',
        pencil: '#2d2d2d',
        muted: '#e5e0d8',
        marker: '#ff4d4d',
        pen: '#2d5da1',
        sticky: '#fff9c4',
      },
      fontFamily: {
        heading: ['Kalam', 'cursive'],
        body: ['Patrick Hand', 'cursive'],
      },
      boxShadow: {
        hard: '4px 4px 0 0 #2d2d2d',
        'hard-lg': '8px 8px 0 0 #2d2d2d',
        'hard-soft': '3px 3px 0 0 rgba(45,45,45,.13)',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-10px) rotate(2deg)' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        },
      },
      animation: {
        floaty: 'floaty 3s ease-in-out infinite',
        wiggle: 'wiggle 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
