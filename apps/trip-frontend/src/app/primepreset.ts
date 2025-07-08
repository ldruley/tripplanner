import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/aura';

export const PrimePreset = definePreset(Lara, {
  semantic: {
    primary: {
      50: '#fdf7f4',
      100: '#fae8e1',
      200: '#f4d1c4',
      300: '#eab49c',
      400: '#dd8c69',
      500: '#cc785c', // Your tp-orange
      600: '#b8654a', // Your tp-orange-hover
      700: '#a3523f',
      800: '#8e4537',
      900: '#7a3a30',
      950: '#4a1e1a',
    },
    colorScheme: {
      light: {
        primary: {
          color: '#cc785c',
          contrastColor: '#ffffff',
          hoverColor: '#b8654a',
          activeColor: '#a3523f',
        },
        background: {
          color: '#ffffff',
        },
        surface: {
          0: '#ffffff',
          50: '#faf9f8', // tp-bg-light-primary
          100: '#f5f4f3', // tp-bg-light-secondary
          200: '#ebe9e7', // tp-bg-light-tertiary
          300: '#e0ddd9', // tp-bg-light-quaternary
          400: '#d1ccc6',
          500: '#b8b4ae',
          600: '#9b9894',
          700: '#706f6e',
          800: '#403e3c',
          900: '#1a1918',
          950: '#0a0a09',
        },
      },
      dark: {
        primary: {
          color: '#cc785c',
          contrastColor: '#ffffff',
          hoverColor: '#b8654a',
          activeColor: '#a3523f',
        },
        surface: {
          0: '#191716', // tp-bg-primary
          50: '#211f1e', // tp-bg-secondary
          100: '#2c2a28', // tp-bg-tertiary
          200: '#38352f', // tp-bg-quaternary
          300: '#4a4642',
          400: '#5c5751',
          500: '#706f6e',
          600: '#9b9a99',
          700: '#c7c6c5',
          800: '#ededec',
          900: '#f7f6f6',
          950: '#fefefe',
        },
      },
    },
  },
  components: {
    datepicker: {
      colorScheme: {
        light: {
          panel: {
            background: '{surface.0}',
            borderColor: '{surface.300}',
            color: '{surface.700}',
            borderRadius: '0.5rem',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          },
          header: {
            background: '{surface.100}',
            borderColor: '{surface.300}',
            color: '{surface.800}'
          },
          title: {
            fontWeight: '500'
          },
          date: {
            color: '{surface.700}',
            hoverBackground: '{surface.200}',
            hoverColor: '{surface.800}',
            selectedBackground: '{primary.color}',
            selectedColor: '{primary.contrast.color}',
            borderRadius: '0.375rem'
          },
          today: {
            background: 'color-mix(in srgb, {primary.color} 10%, transparent)',
            color: '{primary.color}'
          },
          timePicker: {
            borderColor: '{surface.300}'
          },
          weekDay: {
            color: '{surface.600}'
          },
          selectMonth: {
            color: '{surface.700}',
            hoverBackground: '{surface.200}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem'
          },
          selectYear: {
            color: '{surface.700}',
            hoverBackground: '{surface.200}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem'
          },
          dropdown: {
            background: '{surface.0}',
            borderColor: '{surface.300}',
            hoverBorderColor: '{primary.color}',
            activeBorderColor: '{primary.color}',
            color: '{surface.700}',
            hoverColor: '{surface.800}',
            borderRadius: '0.375rem',
            focusRing: {
              color: '{primary.color}',
              width: '2px',
              style: 'solid',
              offset: '2px'
            }
          }
        },
        dark: {
          panel: {
            background: '{surface.50}',
            borderColor: '{surface.200}',
            color: '{surface.800}',
            borderRadius: '0.5rem',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
          },
          header: {
            background: '{surface.100}',
            borderColor: '{surface.200}',
            color: '{surface.900}'
          },
          title: {
            fontWeight: '500'
          },
          date: {
            color: '{surface.800}',
            hoverBackground: '{surface.100}',
            hoverColor: '{surface.900}',
            selectedBackground: '{primary.color}',
            selectedColor: '{primary.contrast.color}',
            borderRadius: '0.375rem'
          },
          today: {
            background: 'color-mix(in srgb, {primary.color} 20%, transparent)',
            color: '{primary.color}'
          },
          timePicker: {
            borderColor: '{surface.200}'
          },
          weekDay: {
            color: '{surface.800}'
          },
          selectMonth: {
            color: '{surface.800}',
            hoverBackground: '{surface.100}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem'
          },
          selectYear: {
            color: '{surface.800}',
            hoverBackground: '{surface.100}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem'
          },
          dropdown: {
            background: '{surface.0}',
            borderColor: '{surface.200}',
            hoverBorderColor: '{primary.color}',
            activeBorderColor: '{primary.color}',
            color: '{surface.800}',
            hoverColor: '{surface.900}',
            borderRadius: '0.375rem',
            focusRing: {
              color: '{primary.color}',
              width: '2px',
              style: 'solid',
              offset: '2px'
            }
          }
        }
      },
    },
  },
});
