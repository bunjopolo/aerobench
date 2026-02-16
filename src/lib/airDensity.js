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
  const defaultDensity = 1.225
  const tempC = Number.isFinite(temperature) ? temperature : 20
  const rh = Number.isFinite(humidity) ? Math.max(0, Math.min(100, humidity)) : 50
  const elevM = Number.isFinite(elevation) ? Math.max(-500, Math.min(10000, elevation)) : 0

  const Rd = 287.05 // Specific gas constant for dry air (J/(kg·K))
  const Rv = 461.495 // Specific gas constant for water vapor (J/(kg·K))
  const Tk = tempC + 273.15 // Temperature in Kelvin
  if (!Number.isFinite(Tk) || Tk <= 0) return defaultDensity

  // Get pressure in hPa
  let P = Number.isFinite(pressure) ? pressure : null
  if (P === null) {
    // Barometric formula: P = P0 × (1 - 2.25577e-5 × h)^5.25588
    P = 1013.25 * Math.pow(1 - 2.25577e-5 * elevM, 5.25588)
  }
  if (!Number.isFinite(P) || P <= 0) return defaultDensity

  // Saturation vapor pressure using Tetens formula (hPa)
  const Es = 6.1078 * Math.pow(10, (7.5 * tempC) / (tempC + 237.3))

  // Actual vapor pressure (hPa)
  const Pv = (rh / 100) * Es

  // Partial pressure of dry air (hPa)
  const Pd = Math.max(0, P - Pv)

  // Air density (kg/m³)
  // ρ = (Pd × 100) / (Rd × Tk) + (Pv × 100) / (Rv × Tk)
  const density = (Pd * 100) / (Rd * Tk) + (Pv * 100) / (Rv * Tk)

  if (!Number.isFinite(density) || density <= 0) return defaultDensity
  return Math.round(density * 10000) / 10000 // Round to 4 decimal places
}
