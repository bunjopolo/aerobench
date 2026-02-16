/**
 * Low-pass filter for noise reduction in Virtual Elevation analysis
 */

/**
 * Zero-phase Butterworth-like low-pass filter (2nd order, forward-backward)
 * @param {number[]} data - Input data array
 * @param {number} intensity - Filter intensity 1-10 (higher = more smoothing)
 * @returns {number[]} Filtered data
 */
export function lowPassFilter(data, intensity = 5) {
  if (!data || data.length < 5) return data

  const n = data.length
  const safeIntensity = Math.max(1, Math.min(10, Number.isFinite(intensity) ? intensity : 5))

  // Map intensity (1-10) to cutoff ratio (0.3 down to 0.03)
  const cutoffRatio = 0.3 - (safeIntensity - 1) * 0.03

  const wc = Math.tan(Math.PI * Math.min(0.4, Math.max(0.01, cutoffRatio)))
  const k1 = Math.sqrt(2) * wc
  const k2 = wc * wc
  const a0 = k2 / (1 + k1 + k2)
  const a1 = 2 * a0
  const a2 = a0
  const b1 = 2 * a0 * (1 / k2 - 1)
  const b2 = 1 - (a0 + a1 + a2 + b1)

  const input = new Array(n)
  let last = Number.isFinite(data[0]) ? data[0] : 0
  for (let i = 0; i < n; i++) {
    const value = data[i]
    if (Number.isFinite(value)) {
      last = value
      input[i] = value
    } else {
      input[i] = last
    }
  }

  const singlePass = (series) => {
    const result = new Array(series.length)
    result[0] = series[0]
    result[1] = series[1]

    for (let i = 2; i < series.length; i++) {
      result[i] = (
        a0 * series[i] +
        a1 * series[i - 1] +
        a2 * series[i - 2] +
        b1 * result[i - 1] +
        b2 * result[i - 2]
      )
    }

    return result
  }

  // Forward-backward pass removes phase lag so traces do not shift horizontally.
  const forward = singlePass(input)
  const backward = singlePass(forward.slice().reverse()).reverse()

  return backward
}
