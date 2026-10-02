module.exports = {
  darkMode: 'class',
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        night: '#0f172a'
      },
      boxShadow: {
        soft: '0 20px 45px rgba(15, 23, 42, 0.12)'
      }
    }
  },
  plugins: []
};
