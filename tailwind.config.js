/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 18px 60px -28px rgba(15, 23, 42, 0.35)'
      },
      backgroundImage: {
        'radial-soft': 'radial-gradient(circle at top, rgba(56, 189, 248, 0.14), transparent 44%), radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.12), transparent 36%)'
      }
    }
  },
  plugins: []
};
