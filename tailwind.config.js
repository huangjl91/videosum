/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F8FC',
        sidebar: '#EEF1F8',
        primary: '#1A73E8',
        hairline: '#E5E7EB',
        ink: '#0A0A0B',
        ink2: '#32323B',
        sub: '#52525B',
        sub2: '#71717A',
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        btn: '4px',
        pill: '24px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(61,64,66,0.06)',
      },
    },
  },
  plugins: [],
};
