const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#007bff', // Your primary brand color
        'secondary': '#6c757d',
        'accent': '#f8c146',
        'text-main': '#333333',
        'text-muted': '#777777',
        'surface': '#f8f9fa',
        'danger': '#dc3545',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'], // Example: using Inter
        serif: ['"Georgia"', 'serif'],
      },
    },
  },
};
