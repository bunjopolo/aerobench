// Variable types for studies
// Each type defines how variations are entered and displayed

export const VARIABLE_TYPES = {
  none: {
    id: 'none',
    label: 'None',
    icon: 'none',
    inputType: 'none',
    description: 'No specific variable. Use configuration names only.',
    formatValue: () => ''
  },
  tires: {
    id: 'tires',
    label: 'Tires',
    icon: 'tire',
    inputType: 'text',
    placeholder: 'e.g., GP5000 25c',
    description: 'Compare different tire models or widths',
    formatValue: (v) => v.value_text || ''
  },
  tire_pressure: {
    id: 'tire_pressure',
    label: 'Tire Pressure',
    icon: 'pressure',
    inputType: 'pressure',
    placeholder: { front: 'Front PSI', rear: 'Rear PSI' },
    description: 'Find your optimal tire pressure',
    formatValue: (v) => {
      if (v.value_number_front && v.value_number_rear) {
        return `${v.value_number_front}/${v.value_number_rear} psi`
      }
      return v.value_number ? `${v.value_number} psi` : ''
    }
  },
  position: {
    id: 'position',
    label: 'Position',
    icon: 'position',
    inputType: 'text',
    description: 'Compare different riding positions',
    formatValue: (v) => v.value_text || ''
  },
  custom: {
    id: 'custom',
    label: 'Other / Custom',
    icon: 'custom',
    inputType: 'text',
    customLabel: true,
    placeholder: 'Enter value',
    description: 'Test any other variable',
    formatValue: (v) => v.value_text || ''
  }
}

// Get variable type config by id
export const getVariableType = (id) => VARIABLE_TYPES[id] || VARIABLE_TYPES.custom

// Get all variable types as array for dropdowns
export const getVariableTypeOptions = () => Object.values(VARIABLE_TYPES)
