const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  darkMode: 'class',
  /*theme: {
    extend: {
      colors: {
        'primary': '#007bff', // Your primary brand color
        'secondary': '#6c757d',
        'accent': '#f8c146',
        'text-main': '#333333',
        'text-muted': '#777777',
        'surface': '#f8f9fa',
        'danger': '#dc3545',
        // Dark mode variants (flattened for Tailwind dark: modifier)
        'dark-primary': '#bb86fc',       // Material Dark Primary (Purple 200)
        'dark-secondary': '#03dac6',     // Teal 200
        'dark-accent': '#ffb300',        // Amber 600 (high-contrast accent)
        'dark-text-main': '#ffffff',     // High-emphasis text
        'dark-text-muted': '#b0b0b0',    // Medium-emphasis text
        'dark-surface': '#1e1e1e',       // Material surface container
        'dark-bg': '#121212',            // Material dark background
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'], // Example: using Inter
        serif: ['"Georgia"', 'serif'],
      },
    },
  },*/
  theme: {
    extend: {
      colors: {
        // Old colors
        'text-main': '#2d3748', // darker gray for light mode
        'dark-bg': '#191716', // Claude's actual dark background
        'dark-text-main': '#ededec', // Claude's light text
        'dark-text-secondary': '#9b9a99', // Claude's secondary text
        'dark-text-muted': '#706f6e', // Claude's muted text

        tp: {
          // Dark backgrounds (elevation hierarchy)
          'bg-primary': '#191716', // Main dark background (deepest)
          'bg-secondary': '#211f1e', // Slightly lighter panels
          'bg-tertiary': '#2c2a28', // Cards and elevated surfaces
          'bg-quaternary': '#38352f', // Hover states (lightest)

          // Light backgrounds (inverse elevation hierarchy)
          'bg-light-primary': '#faf9f8', // Main light background (lightest)
          'bg-light-secondary': '#f5f4f3', // Slight depth
          'bg-light-tertiary': '#ebe9e7', // Cards and panels
          'bg-light-quaternary': '#e0ddd9', // Elevated/hover states (darkest)

          // Text colors - Dark theme
          'text-primary': '#ededec', // Primary text in dark (high contrast)
          'text-secondary': '#9b9a99', // Secondary text in dark (medium emphasis)
          'text-muted': '#706f6e', // Muted text in dark (low emphasis)

          // Text colors - Light theme (systematic hierarchy)
          'text-light-primary': '#1a1918', // Primary text in light (high contrast)
          'text-light-secondary': '#403e3c', // Secondary text in light (medium emphasis)
          'text-light-muted': '#6b6866', // Muted text in light (low emphasis)

          // Orange accent
          orange: '#cc785c', // Trip planner's signature orange
          'orange-hover': '#b8654a', // Darker orange for hover
          'orange-light': '#f7931e', // Lighter orange variant

          // Borders - Dark theme
          border: '#38352f', // Default border in dark
          'border-subtle': '#2c2a28', // Subtle borders in dark

          // Borders - Light theme
          'border-light': '#e0ddd9', // Default border in light (matches bg-light-quaternary)
          'border-light-strong': '#d1ccc6', // More defined borders in light
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
      },
    },
  },
};
