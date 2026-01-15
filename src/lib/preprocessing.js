/**
 * Low-pass filter for noise reduction in Virtual Elevation analysis
 */

/**
 * Butterworth low-pass filter (2nd order)
 * @param {number[]} data - Input data array
 * @param {number} intensity - Filter intensity 1-10 (higher = more smoothing)
 * @returns {number[]} Filtered data
 */
export function lowPassFilter(data, intensity = 5) {
  if (!data || data.length < 5) return data

  // Map intensity (1-10) to cutoff ratio (0.3 down to 0.03)
  const cutoffRatio = 0.3 - (intensity - 1) * 0.03

  const wc = Math.tan(Math.PI * Math.min(0.4, Math.max(0.01, cutoffRatio)))
  const k1 = Math.sqrt(2) * wc
  const k2 = wc * wc
  const a0 = k2 / (1 + k1 + k2)
  const a1 = 2 * a0
  const a2 = a0
  const b1 = 2 * a0 * (1 / k2 - 1)
  const b2 = 1 - (a0 + a1 + a2 + b1)

  const result = new Array(data.length)
  result[0] = data[0]
  result[1] = data[1]

  for (let i = 2; i < data.length; i++) {
    result[i] = a0 * data[i] + a1 * data[i - 1] + a2 * data[i - 2] + b1 * result[i - 1] + b2 * result[i - 2]
  }

  return result
}
