/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // 企业级密排：正文 14px / 正文次级 13px / 小字 12px，标题 16/20/24/28
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '18px'],
        sm: ['13px', '20px'],
        base: ['14px', '22px'],
        lg: ['16px', '24px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['28px', '36px'],
      },
      boxShadow: {
        // 卡片只用一级极轻阴影 + 边框表达层级，去掉光晕
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.08)',
        pop: '0 12px 32px -16px rgba(15, 23, 42, 0.28)',
      },
    },
  },
  plugins: [],
};
