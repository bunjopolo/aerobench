// Physical constants
export const GRAVITY = 9.81

// Chain efficiency data
export const CHAIN_DATA = {
  "Shimano 11 (3.2W)": 0.9872,
  "KMC 12 (3.3W)": 0.9868,
  "SRAM Force 12 (4.9W)": 0.9804,
  "Shimano 12S (5.1W)": 0.9796,
  "KMC 11 (3.7W)": 0.9852,
  "Custom (Waxed)": 0.985
}

// Haversine formula for distance between GPS points
export const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3
  const p = Math.PI / 180
  const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
            Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lon2 - lon1) * p)) / 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Calculate bearing between two GPS points
export const calcBearing = (lat1, lon1, lat2, lon2) => {
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// Savitzky-Golay smoothing filter
export const savgol = (arr) => {
  const c = [-21, 14, 39, 54, 59, 54, 39, 14, -21]
  const norm = 231
  return arr.map((_, i) => {
    if (i < 4 || i >= arr.length - 4) return arr[i]
    let sum = 0
    for (let j = 0; j < 9; j++) sum += arr[i - 4 + j] * c[j]
    return sum / norm
  })
}

// Safe number parsing helper
export const safeNum = (val, fallback) => {
  const n = parseFloat(val)
  return isNaN(n) ? fallback : n
}

// Solve for velocity given power and conditions
export const solveVelocity = (watts, grade, mass, cda, crr, rho, eff, elev = 0, useDynamicRho = true) => {
  const wheelPwr = watts * eff
  const theta = Math.atan(grade / 100)
  const fRes = mass * GRAVITY * (Math.sin(theta) + crr * Math.cos(theta))

  // Adjust rho for altitude if elevation is provided
  let localRho = rho
  if (useDynamicRho && typeof elev === 'number') {
    localRho = rho * Math.exp(-elev / 9000)
  }

  const K = 0.5 * localRho * cda

  // Newton-Raphson solver
  let v = 10
  for (let i = 0; i < 10; i++) {
    const f = K * v * v * v + fRes * v - wheelPwr
    const df = 3 * K * v * v + fRes
    if (Math.abs(df) < 1e-6) break
    v = v - f / df
  }
  return Math.max(0, v)
}

// CdA/Crr solver for a segment
export const solveCdaCrr = (
  data, si, ei, initialCda, initialCrr, mass, eff, rho, offset, wSpd, wDir, fastMode = false
) => {
  const { pwr, v, a, ds, ele, b } = data

  // Calculate segment statistics for quality assessment
  const segEle = ele.slice(si, ei)
  const segV = v.slice(si, ei)
  const segDs = ds.slice(si, ei)

  // Grade variance
  const grades = []
  for (let i = 1; i < segEle.length; i++) {
    const d = segDs[i]
    if (d > 0.5) grades.push((segEle[i] - segEle[i - 1]) / d * 100)
  }
  const gradeVar = grades.length > 1 ?
    grades.reduce((sum, g) => sum + Math.pow(g - grades.reduce((a, b) => a + b, 0) / grades.length, 2), 0) / grades.length : 0

  // Speed variance
  const avgSpeed = segV.reduce((a, b) => a + b, 0) / segV.length
  const speedVar = segV.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / segV.length
  const avgSpeedKph = avgSpeed * 3.6

  const calc = (tc, tr) => {
    let e = 0, n = 0, cur = ele[si]
    const io = Math.round(offset)
    const wr = wDir * (Math.PI / 180)
    for (let i = si; i < ei; i++) {
      const vg = Math.max(0.1, v[i])
      let pi = i - io
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1
      const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wr)
      const f = (pwr[pi] * eff / vg) - (mass * GRAVITY * tr) - (mass * a[i]) - (0.5 * (rho * Math.exp(-ele[i] / 9000)) * tc * va * va * Math.sign(va))
      cur += (f / (mass * GRAVITY)) * ds[i]
      e += (cur - ele[i]) ** 2
      n++
    }
    return Math.sqrt(e / n)
  }

  // Multi-start optimization
  const startPoints = fastMode ? [
    [initialCda, initialCrr],
    [0.28, 0.0045],
  ] : [
    [initialCda, initialCrr],
    [0.25, 0.004],
    [0.30, 0.005],
    [0.35, 0.006],
    [0.22, 0.003],
  ]

  const maxIter = fastMode ? 300 : 500
  const minStep = fastMode ? 0.00001 : 0.000005

  let globalBest = { cda: initialCda, crr: initialCrr, rmse: Infinity }

  for (const [startCda, startCrr] of startPoints) {
    let bc = startCda, br = startCrr, min = calc(bc, br)
    let dc = 0.01, dr = 0.001

    for (let k = 0; k < maxIter; k++) {
      let imp = false
      const directions = [
        [dc, 0], [-dc, 0], [0, dr], [0, -dr],
        [dc, dr], [dc, -dr], [-dc, dr], [-dc, -dr]
      ]
      for (const [x, y] of directions) {
        const nc = bc + x, nr = br + y
        if (nc > 0.1 && nc < 0.6 && nr > 0.001 && nr < 0.015) {
          const ne = calc(nc, nr)
          if (ne < min) { min = ne; bc = nc; br = nr; imp = true }
        }
      }
      if (!imp) { dc *= 0.8; dr *= 0.8; if (dc < minStep) break }
    }

    if (min < globalBest.rmse) {
      globalBest = { cda: bc, crr: br, rmse: min }
    }
  }

  const quality = (1 / (1 + globalBest.rmse)) * (1 + Math.sqrt(gradeVar)) * (1 + Math.sqrt(speedVar) * 0.5)

  return {
    cda: globalBest.cda,
    crr: globalBest.crr,
    rmse: globalBest.rmse,
    gradeVar,
    speedVar,
    avgSpeed: avgSpeedKph,
    quality
  }
}

// IQR-based outlier detection
export const removeOutliers = (segments, key) => {
  if (segments.length < 4) return segments
  const values = segments.map(s => s[key]).sort((a, b) => a - b)
  const q1 = values[Math.floor(values.length * 0.25)]
  const q3 = values[Math.floor(values.length * 0.75)]
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr
  return segments.filter(s => s[key] >= lower && s[key] <= upper)
}
