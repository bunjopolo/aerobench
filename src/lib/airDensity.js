// Air density calculation utility
// Calculate air density from temperature, pressure/elevation, and humidity

/**
 * Calculate air density from atmospheric conditions
 * @param {Object} params - Atmospheric parameters
 * @param {number} params.temperature - Temperature in Celsius
 * @param {number} params.humidity - Relative humidity (0-100)
 * @param {number} [params.elevation] - Elevation in meters (used if pressure not provided)
 * @param {number} [params.pressure] - Pressure in hPa (takes precedence over elevation)
 * @returns {number} Air density in kg/m³
 */
export const calculateAirDensity = ({ temperature, humidity, elevation = 0, pressure = null }) => {
  const Rd = 287.05 // Specific gas constant for dry air (J/(kg·K))
  const Rv = 461.495 // Specific gas constant for water vapor (J/(kg·K))
  const Tk = temperature + 273.15 // Temperature in Kelvin

  // Get pressure in hPa
  let P = pressure
  if (P === null) {
    // Barometric formula: P = P0 × (1 - 2.25577e-5 × h)^5.25588
    P = 1013.25 * Math.pow(1 - 2.25577e-5 * elevation, 5.25588)
  }

  // Saturation vapor pressure using Tetens formula (hPa)
  const Es = 6.1078 * Math.pow(10, (7.5 * temperature) / (temperature + 237.3))

  // Actual vapor pressure (hPa)
  const Pv = (humidity / 100) * Es

  // Partial pressure of dry air (hPa)
  const Pd = P - Pv

  // Air density (kg/m³)
  // ρ = (Pd × 100) / (Rd × Tk) + (Pv × 100) / (Rv × Tk)
  const density = (Pd * 100) / (Rd * Tk) + (Pv * 100) / (Rv * Tk)

  return Math.round(density * 10000) / 10000 // Round to 4 decimal places
}
