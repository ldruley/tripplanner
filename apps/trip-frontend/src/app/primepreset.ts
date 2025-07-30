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
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
          header: {
            background: '{surface.100}',
            borderColor: '{surface.300}',
            color: '{surface.800}',
          },
          title: {
            fontWeight: '500',
          },
          date: {
            color: '{surface.700}',
            hoverBackground: '{surface.200}',
            hoverColor: '{surface.800}',
            selectedBackground: '{primary.color}',
            selectedColor: '{primary.contrast.color}',
            borderRadius: '0.375rem',
          },
          today: {
            background: 'color-mix(in srgb, {primary.color} 10%, transparent)',
            color: '{primary.color}',
          },
          timePicker: {
            borderColor: '{surface.300}',
          },
          weekDay: {
            color: '{surface.600}',
          },
          selectMonth: {
            color: '{surface.700}',
            hoverBackground: '{surface.200}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem',
          },
          selectYear: {
            color: '{surface.700}',
            hoverBackground: '{surface.200}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem',
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
              offset: '2px',
            },
          },
        },
        dark: {
          panel: {
            background: '{surface.50}',
            borderColor: '{surface.200}',
            color: '{surface.800}',
            borderRadius: '0.5rem',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
          },
          header: {
            background: '{surface.100}',
            borderColor: '{surface.200}',
            color: '{surface.900}',
          },
          title: {
            fontWeight: '500',
          },
          date: {
            color: '{surface.800}',
            hoverBackground: '{surface.100}',
            hoverColor: '{surface.900}',
            selectedBackground: '{primary.color}',
            selectedColor: '{primary.contrast.color}',
            borderRadius: '0.375rem',
          },
          today: {
            background: 'color-mix(in srgb, {primary.color} 20%, transparent)',
            color: '{primary.color}',
          },
          timePicker: {
            borderColor: '{surface.200}',
          },
          weekDay: {
            color: '{surface.800}',
          },
          selectMonth: {
            color: '{surface.800}',
            hoverBackground: '{surface.100}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem',
          },
          selectYear: {
            color: '{surface.800}',
            hoverBackground: '{surface.100}',
            hoverColor: '{primary.color}',
            borderRadius: '0.375rem',
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
              offset: '2px',
            },
          },
        },
      },
    },
    tabs: {
      colorScheme: {
        light: {
          tablist: {
            background: 'transparent',
            borderColor: '{surface.200}',
          },
          tab: {
            background: 'transparent',
            hoverBackground: '{surface.100}',
            activeBackground: 'transparent',
            color: '{surface.600}',
            hoverColor: '{surface.800}',
            activeColor: '{primary.color}',
            activeBorderColor: '{primary.color}',
            padding: '1rem',
            fontWeight: '500',
            focusRing: {
              color: '{primary.color}',
              width: '2px',
              style: 'solid',
              offset: '2px',
            },
          },
          tabpanel: {
            background: 'transparent',
            color: '{surface.700}',
            padding: '1rem 0',
            focusRing: {
              color: '{primary.color}',
              width: '2px',
              style: 'solid',
              offset: '2px',
            },
          },
          activeBar: {
            height: '2px',
            background: '{primary.color}',
          },
        },
        dark: {
          tablist: {
            background: 'transparent',
            borderColor: '{surface.700}',
          },
          tab: {
            background: 'transparent',
            hoverBackground: '{surface.800}',
            activeBackground: 'transparent',
            color: '{surface.500}',
            hoverColor: '{surface.300}',
            activeColor: '{primary.color}',
            activeBorderColor: '{primary.color}',
            padding: '1rem',
            fontWeight: '500',
            focusRing: {
              color: '{primary.color}',
              width: '2px',
              style: 'solid',
              offset: '2px',
            },
          },
          tabpanel: {
            background: 'transparent',
            color: '{surface.400}',
            padding: '1rem 0',
            focusRing: {
              color: '{primary.color}',
              width: '2px',
              style: 'solid',
              offset: '2px',
            },
          },
          activeBar: {
            height: '2px',
            background: '{primary.color}',
          },
        },
      },
    },
    inputtext: {
      colorScheme: {
        light: {
          root: {
            background: '{surface.200}', // tp-bg-light-tertiary
            borderColor: '{surface.300}', // tp-border-light
            color: '{surface.900}', // tp-text-light-primary
            placeholderColor: '{surface.700}', // tp-text-light-secondary
            focusBorderColor: '{primary.color}', // tp-orange
            focusRing: {
              color: '{primary.color}', // tp-orange
            },
          },
        },
        dark: {
          root: {
            background: '{surface.100}', // tp-bg-tertiary
            borderColor: '{surface.200}', // tp-border
            color: '{surface.800}', // tp-text-primary
            placeholderColor: '{surface.600}', // tp-text-muted
            focusBorderColor: '{primary.color}', // tp-orange
            focusRing: {
              color: '{primary.color}', // tp-orange
            },
          },
        },
      },
    },
    toast: {
      root: {
        width: '24rem',
        borderRadius: '0.5rem',
        borderWidth: '1px',
        transitionDuration: '300ms',
      },
      icon: {
        size: '1.25rem',
      },
      content: {
        padding: '1rem',
        gap: '0.75rem',
      },
      text: {
        gap: '0.25rem',
      },
      summary: {
        fontWeight: '600',
        fontSize: '0.875rem',
      },
      detail: {
        fontWeight: '400',
        fontSize: '0.75rem',
      },
      closeButton: {
        width: '1.5rem',
        height: '1.5rem',
        borderRadius: '0.25rem',
        focusRing: {
          width: '2px',
          style: 'solid',
          offset: '2px',
        },
      },
      closeIcon: {
        size: '0.875rem',
      },
      colorScheme: {
        light: {
          info: {
            background: '#eff6ff', // Blue-50
            borderColor: '#93c5fd', // Blue-300
            color: '#1e40af', // Blue-800
            detailColor: '#3730a3', // Blue-700
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            closeButton: {
              hoverBackground: '#dbeafe', // Blue-100
              focusRing: {
                color: '#3b82f6', // Blue-500
                shadow: '0 0 0 2px #3b82f6',
              },
            },
          },
          success: {
            background: '#f0fdf4', // Green-50
            borderColor: '#86efac', // Green-300
            color: '#166534', // Green-800
            detailColor: '#15803d', // Green-700
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            closeButton: {
              hoverBackground: '#dcfce7', // Green-100
              focusRing: {
                color: '#22c55e', // Green-500
                shadow: '0 0 0 2px #22c55e',
              },
            },
          },
          warn: {
            background: '#fffbeb', // Amber-50
            borderColor: '#fcd34d', // Amber-300
            color: '#92400e', // Amber-800
            detailColor: '#d97706', // Amber-600
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            closeButton: {
              hoverBackground: '#fef3c7', // Amber-100
              focusRing: {
                color: '#f59e0b', // Amber-500
                shadow: '0 0 0 2px #f59e0b',
              },
            },
          },
          error: {
            background: '#fef2f2', // Red-50
            borderColor: '#fca5a5', // Red-300
            color: '#991b1b', // Red-800
            detailColor: '#dc2626', // Red-600
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            closeButton: {
              hoverBackground: '#fee2e2', // Red-100
              focusRing: {
                color: '#ef4444', // Red-500
                shadow: '0 0 0 2px #ef4444',
              },
            },
          },
          secondary: {
            background: '{surface.50}',
            borderColor: '{surface.300}',
            color: '{surface.700}',
            detailColor: '{surface.600}',
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            closeButton: {
              hoverBackground: '{surface.100}',
              focusRing: {
                color: '{surface.500}',
                shadow: '0 0 0 2px {surface.500}',
              },
            },
          },
          contrast: {
            background: '{surface.900}',
            borderColor: '{surface.700}',
            color: '{surface.50}',
            detailColor: '{surface.200}',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            closeButton: {
              hoverBackground: '{surface.800}',
              focusRing: {
                color: '{surface.300}',
                shadow: '0 0 0 2px {surface.300}',
              },
            },
          },
        },
        dark: {
          info: {
            background: '#0f172a', // Slate-900 with blue tint
            borderColor: '#1e40af', // Blue-800
            color: '#93c5fd', // Blue-300
            detailColor: '#60a5fa', // Blue-400
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
            closeButton: {
              hoverBackground: '#1e3a8a', // Blue-900
              focusRing: {
                color: '#3b82f6', // Blue-500
                shadow: '0 0 0 2px #3b82f6',
              },
            },
          },
          success: {
            background: '#0f1b0f', // Dark green background
            borderColor: '#166534', // Green-800
            color: '#86efac', // Green-300
            detailColor: '#4ade80', // Green-400
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
            closeButton: {
              hoverBackground: '#14532d', // Green-900
              focusRing: {
                color: '#22c55e', // Green-500
                shadow: '0 0 0 2px #22c55e',
              },
            },
          },
          warn: {
            background: '#1c1917', // Stone-900 with amber tint
            borderColor: '#92400e', // Amber-800
            color: '#fcd34d', // Amber-300
            detailColor: '#fbbf24', // Amber-400
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
            closeButton: {
              hoverBackground: '#78350f', // Amber-900
              focusRing: {
                color: '#f59e0b', // Amber-500
                shadow: '0 0 0 2px #f59e0b',
              },
            },
          },
          error: {
            background: '#1c1917', // Stone-900 with red tint
            borderColor: '#991b1b', // Red-800
            color: '#fca5a5', // Red-300
            detailColor: '#f87171', // Red-400
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
            closeButton: {
              hoverBackground: '#7f1d1d', // Red-900
              focusRing: {
                color: '#ef4444', // Red-500
                shadow: '0 0 0 2px #ef4444',
              },
            },
          },
          secondary: {
            background: '{surface.50}',
            borderColor: '{surface.200}',
            color: '{surface.800}',
            detailColor: '{surface.700}',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
            closeButton: {
              hoverBackground: '{surface.100}',
              focusRing: {
                color: '{surface.500}',
                shadow: '0 0 0 2px {surface.500}',
              },
            },
          },
          contrast: {
            background: '{surface.950}',
            borderColor: '{surface.800}',
            color: '{surface.100}',
            detailColor: '{surface.300}',
            shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            closeButton: {
              hoverBackground: '{surface.900}',
              focusRing: {
                color: '{surface.400}',
                shadow: '0 0 0 2px {surface.400}',
              },
            },
          },
        },
      },
    },
    card: {
      colorScheme: {
        light: {
          root: {
            background: '{surface.50}', // tp-bg-light-primary
            borderRadius: '0.5rem',
            color: '{surface.900}', // tp-text-light-primary
            shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          },
          body: {
            padding: '1rem',
            gap: '0.75rem',
          },
          title: {
            fontSize: '1.125rem',
            fontWeight: '600',
          },
          subtitle: {
            color: '{surface.600}', // tp-text-light-secondary
          },
        },
        dark: {
          root: {
            background: '{surface.0}', // tp-bg-primary
            borderRadius: '0.5rem',
            color: '{surface.900}', // tp-text-primary
            shadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
          },
          body: {
            padding: '1rem',
            gap: '0.75rem',
          },
          title: {
            fontSize: '1.125rem',
            fontWeight: '600',
          },
          subtitle: {
            color: '{surface.600}', // tp-text-secondary
          },
        },
      },
    },
  },
});
