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

const LARGE_RESIDUAL = 1e6
const DEFAULT_CDA_BOUNDS = [0.15, 0.50]
const DEFAULT_CRR_BOUNDS = [0.002, 0.012]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const normalizeBounds = (rawBounds, fallbackBounds) => {
  if (!Array.isArray(rawBounds) || rawBounds.length < 2) return [...fallbackBounds]
  let min = Number(rawBounds[0])
  let max = Number(rawBounds[1])
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [...fallbackBounds]
  if (min > max) [min, max] = [max, min]
  if (max - min < 1e-9) return [...fallbackBounds]
  return [min, max]
}

const clampParamsToBounds = (params, bounds) => ([
  clamp(params[0], bounds[0][0], bounds[0][1]),
  clamp(params[1], bounds[1][0], bounds[1][1])
])

const safeArrayValue = (arr, idx, fallback = 0) => {
  if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return fallback
  const value = arr[idx]
  return Number.isFinite(value) ? value : fallback
}

const getCommonSeriesLength = (data, keys = ['pwr', 'v', 'a', 'ds', 'ele', 'b']) => {
  if (!data || typeof data !== 'object') return 0
  let len = Infinity
  for (const key of keys) {
    const series = data[key]
    if (!Array.isArray(series) || series.length === 0) return 0
    len = Math.min(len, series.length)
  }
  return Number.isFinite(len) ? len : 0
}

const normalizeRangeIndices = (len, si, ei) => {
  if (!Number.isFinite(len) || len < 2) return null
  const sRaw = Number.isFinite(si) ? Math.floor(si) : 0
  const eRaw = Number.isFinite(ei) ? Math.floor(ei) : len
  let sIdx = clamp(sRaw, 0, len - 2)
  let eIdx = clamp(eRaw, sIdx + 2, len)
  if (eIdx - sIdx < 2) {
    sIdx = Math.max(0, len - 2)
    eIdx = len
  }
  return { si: sIdx, ei: eIdx, n: eIdx - sIdx }
}

const sanitizeResiduals = (rawResiduals, targetLength = null) => {
  if (!Array.isArray(rawResiduals) || rawResiduals.length === 0) {
    return [LARGE_RESIDUAL]
  }
  const residuals = rawResiduals.map((ri) => (Number.isFinite(ri) ? ri : LARGE_RESIDUAL))
  if (targetLength == null || targetLength <= 0) return residuals
  if (residuals.length === targetLength) return residuals
  if (residuals.length > targetLength) return residuals.slice(0, targetLength)

  const padded = [...residuals]
  while (padded.length < targetLength) padded.push(LARGE_RESIDUAL)
  return padded
}

const buildStartPoints = (points, bounds) => {
  const deduped = []
  const seen = new Set()
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) continue
    const clamped = clampParamsToBounds([
      Number.isFinite(point[0]) ? point[0] : bounds[0][0],
      Number.isFinite(point[1]) ? point[1] : bounds[1][0]
    ], bounds)
    const key = `${clamped[0].toFixed(7)}:${clamped[1].toFixed(8)}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(clamped)
  }
  return deduped.length > 0 ? deduped : [clampParamsToBounds([0.28, 0.0045], bounds)]
}

const nearLowerBound = (value, bounds) => {
  const [min, max] = bounds
  const tol = Math.max((max - min) * 0.01, 1e-5)
  return value - min <= tol
}

const nearUpperBound = (value, bounds) => {
  const [min, max] = bounds
  const tol = Math.max((max - min) * 0.01, 1e-5)
  return max - value <= tol
}

const computeRailingDetails = (cda, crr, cdaBounds, crrBounds) => {
  const cdaAtLowerBound = nearLowerBound(cda, cdaBounds)
  const cdaAtUpperBound = nearUpperBound(cda, cdaBounds)
  const crrAtLowerBound = nearLowerBound(crr, crrBounds)
  const crrAtUpperBound = nearUpperBound(crr, crrBounds)
  return {
    cdaAtLowerBound,
    cdaAtUpperBound,
    crrAtLowerBound,
    crrAtUpperBound
  }
}

const computeVeStepDelta = (data, i, io, wr, mass, eff, rho, cda, crr, wSpd) => {
  const { pwr, v, a, ds, b } = data
  const vg = Math.max(1.0, safeArrayValue(v, i, 1.0))
  const pi = clamp(i - io, 0, pwr.length - 1)
  const power = safeArrayValue(pwr, pi, 0) * eff
  const accel = safeArrayValue(a, i, 0)
  const distanceStep = Math.max(0, safeArrayValue(ds, i, 0))
  const bearingRad = safeArrayValue(b, i, 0) * (Math.PI / 180)
  const va = vg + wSpd * Math.cos(bearingRad - wr)

  const dragForce = 0.5 * rho * cda * va * va * Math.sign(va)
  const tractionForce = power / vg
  const rollingForce = mass * GRAVITY * crr
  const inertialForce = mass * accel
  const netForce = tractionForce - rollingForce - inertialForce - dragForce
  const delta = (netForce / (mass * GRAVITY)) * distanceStep
  return Number.isFinite(delta) ? delta : 0
}

export const computeSegmentStats = (data, sIdx, eIdx) => {
  if (!data || !Array.isArray(data.v) || !Array.isArray(data.ele) || !Array.isArray(data.ds)) {
    return { gradeVar: 0, speedVar: 0, avgSpeedKph: 0, speedSpanKph: 0 }
  }

  const segEle = data.ele.slice(sIdx, eIdx)
  const segV = data.v.slice(sIdx, eIdx).filter(Number.isFinite)
  const segDs = data.ds.slice(sIdx, eIdx)

  const grades = []
  for (let i = 1; i < segEle.length; i++) {
    const d = Number.isFinite(segDs[i]) ? segDs[i] : 0
    const elev = Number.isFinite(segEle[i]) ? segEle[i] : segEle[i - 1]
    const prevElev = Number.isFinite(segEle[i - 1]) ? segEle[i - 1] : elev
    if (d > 0.5) grades.push(((elev - prevElev) / d) * 100)
  }

  let gradeVar = 0
  if (grades.length > 1) {
    const gradeMean = grades.reduce((a, b) => a + b, 0) / grades.length
    gradeVar = grades.reduce((sum, g) => sum + Math.pow(g - gradeMean, 2), 0) / grades.length
  }

  const avgSpeed = segV.length > 0 ? segV.reduce((a, b) => a + b, 0) / segV.length : 0
  const minSpeed = segV.length > 0 ? Math.min(...segV) : 0
  const maxSpeed = segV.length > 0 ? Math.max(...segV) : 0
  const speedVar = segV.length > 0
    ? segV.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / segV.length
    : 0

  return {
    gradeVar,
    speedVar,
    avgSpeedKph: avgSpeed * 3.6,
    speedSpanKph: Math.max(0, (maxSpeed - minSpeed) * 3.6)
  }
}

// Residual diagnostics for VE fit quality and robustness checks.
export const computeResidualMetrics = (err, ele, sIdx, eIdx, dist = null) => {
  if (!Array.isArray(err) || !Array.isArray(ele) || !Number.isFinite(sIdx) || !Number.isFinite(eIdx) || eIdx - sIdx < 2) {
    return { mae: 0, bias: 0, drift: 0, nrmse: 0, residualSlopeMPerKm: 0, residualLag1: 0 }
  }

  let absSum = 0
  let signedSum = 0
  let sqSum = 0
  let cnt = 0
  let eleMin = Infinity
  let eleMax = -Infinity

  for (let i = sIdx; i < eIdx; i++) {
    const r = Number.isFinite(err[i]) ? err[i] : 0
    const e = Number.isFinite(ele[i]) ? ele[i] : 0
    absSum += Math.abs(r)
    signedSum += r
    sqSum += r * r
    eleMin = Math.min(eleMin, e)
    eleMax = Math.max(eleMax, e)
    cnt++
  }

  const rmse = cnt > 0 ? Math.sqrt(sqSum / cnt) : 0
  const mae = cnt > 0 ? absSum / cnt : 0
  const bias = cnt > 0 ? signedSum / cnt : 0
  const drift = (Number.isFinite(err[eIdx - 1]) ? err[eIdx - 1] : 0) - (Number.isFinite(err[sIdx]) ? err[sIdx] : 0)
  const elevRange = Math.max(1e-6, eleMax - eleMin)
  const nrmse = rmse / elevRange

  // Linear trend slope of residual vs distance/index, reported in m per km.
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0
  for (let i = sIdx; i < eIdx; i++) {
    const x = Array.isArray(dist) && Number.isFinite(dist[i]) && Number.isFinite(dist[sIdx])
      ? (dist[i] - dist[sIdx])
      : (i - sIdx)
    const y = Number.isFinite(err[i]) ? err[i] : 0
    sumX += x
    sumY += y
    sumXX += x * x
    sumXY += x * y
  }
  const denom = (cnt * sumXX - sumX * sumX)
  const slopePerMeter = Math.abs(denom) > 1e-12 ? ((cnt * sumXY - sumX * sumY) / denom) : 0
  const residualSlopeMPerKm = slopePerMeter * 1000

  // Lag-1 autocorrelation of residuals.
  let lagNum = 0
  let lagDen = 0
  const meanErr = cnt > 0 ? signedSum / cnt : 0
  for (let i = sIdx + 1; i < eIdx; i++) {
    const a = (Number.isFinite(err[i - 1]) ? err[i - 1] : 0) - meanErr
    const b = (Number.isFinite(err[i]) ? err[i] : 0) - meanErr
    lagNum += a * b
  }
  for (let i = sIdx; i < eIdx; i++) {
    const d = (Number.isFinite(err[i]) ? err[i] : 0) - meanErr
    lagDen += d * d
  }
  const residualLag1 = lagDen > 1e-12 ? lagNum / lagDen : 0

  return { mae, bias, drift, nrmse, residualSlopeMPerKm, residualLag1 }
}

// Solve for velocity given power and conditions.
// rho is expected to be local ambient air density (kg/m^3).
// windSpeed in m/s, positive = headwind, negative = tailwind
export const solveVelocity = (watts, grade, mass, cda, crr, rho, eff, elev = 0, windSpeed = 0) => {
  void elev // Retained for backward-compatible signature.
  const wheelPwr = Math.max(0, watts * eff)
  const theta = Math.atan(grade / 100)
  const fRes = mass * GRAVITY * (Math.sin(theta) + crr * Math.cos(theta))
  const K = 0.5 * rho * cda

  const powerBalance = (v) => {
    const vg = Math.max(0.05, v)
    const va = vg + windSpeed // apparent air velocity
    const fAero = K * va * Math.abs(va) // drag force (preserves sign)
    return (fAero + fRes) * vg - wheelPwr
  }

  const powerBalanceDerivative = (v) => {
    const vg = Math.max(0.05, v)
    const va = vg + windSpeed
    const dragTerm = va * Math.abs(va)
    const dDragTerm = 2 * Math.abs(va)
    return K * (dragTerm + vg * dDragTerm) + fRes
  }

  // Bracket the physically relevant root (balance crossing from negative to positive).
  let low = 0.05
  let high = 20
  let fLow = powerBalance(low)
  let fHigh = powerBalance(high)

  if (fLow > 0) return low
  while (fHigh < 0 && high < 120) {
    high *= 1.5
    fHigh = powerBalance(high)
  }

  // No upper crossing found in a realistic range: return the best bounded estimate.
  if (fHigh < 0) return high

  let v = Math.min(Math.max(10, low), high)

  // Safeguarded Newton iterations with bisection fallback.
  for (let i = 0; i < 30; i++) {
    const f = powerBalance(v)
    if (Math.abs(f) < 1e-7) return Math.max(0, v)

    if (f > 0) {
      high = v
    } else {
      low = v
    }

    const df = powerBalanceDerivative(v)
    let next = Number.NaN
    if (Number.isFinite(df) && Math.abs(df) > 1e-8) {
      next = v - (f / df)
    }

    // Keep root bracketed for robustness.
    if (!Number.isFinite(next) || next <= low || next >= high) {
      next = (low + high) / 2
    }
    v = next
  }

  return Math.max(0, (low + high) / 2)
}

// ============================================================================
// LEVENBERG-MARQUARDT SOLVER
// ============================================================================
// Robust nonlinear least-squares optimization that interpolates between
// gradient descent (far from solution) and Gauss-Newton (near solution).
// Much more robust than coordinate descent for ill-conditioned problems.

// Solve 2x2 linear system: Ax = b using Cramer's rule
// Returns null if system is singular
const solve2x2 = (A, b) => {
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
  if (Math.abs(det) < 1e-15) return null
  return [
    (b[0] * A[1][1] - b[1] * A[0][1]) / det,
    (A[0][0] * b[1] - A[1][0] * b[0]) / det
  ]
}

// Core Levenberg-Marquardt optimizer for 2 parameters
// residualFn: (params) => [r1, r2, ..., rN] array of residuals
// params0: [p1, p2] initial parameters
// bounds: [[min1, max1], [min2, max2]] parameter bounds
// options: { maxIter, tol, lambdaInit, lambdaUp, lambdaDown }
const levenbergMarquardt = (residualFn, params0, bounds, options = {}) => {
  const {
    maxIter = 100,
    tol = 1e-8,
    lambdaInit = 0.01,
    lambdaUp = 10,
    lambdaDown = 0.1,
    finiteDiffStep = [1e-6, 1e-7]  // Step sizes for CdA, Crr
  } = options

  let params = clampParamsToBounds(params0, bounds)
  let lambda = lambdaInit

  const evaluateResiduals = (p, targetLength = null) => {
    const clamped = clampParamsToBounds(p, bounds)
    return sanitizeResiduals(residualFn(clamped), targetLength)
  }

  // Calculate sum of squared residuals
  const calcSSR = (p) => {
    const r = evaluateResiduals(p)
    return r.reduce((sum, ri) => sum + ri * ri, 0)
  }

  // Calculate Jacobian numerically (2 columns for CdA, Crr)
  const calcJacobian = (p) => {
    const clamped = clampParamsToBounds(p, bounds)
    const r0 = evaluateResiduals(clamped)
    const n = r0.length
    const J = Array(n).fill(null).map(() => [0, 0])

    for (let j = 0; j < 2; j++) {
      const span = Math.max(1e-9, bounds[j][1] - bounds[j][0])
      const baseStep = Number.isFinite(finiteDiffStep[j]) ? Math.abs(finiteDiffStep[j]) : span * 1e-5
      const h = Math.max(baseStep, Math.abs(clamped[j]) * 1e-5, span * 1e-6, 1e-9)

      const pPlus = [...clamped]
      const pMinus = [...clamped]
      pPlus[j] = clamp(clamped[j] + h, bounds[j][0], bounds[j][1])
      pMinus[j] = clamp(clamped[j] - h, bounds[j][0], bounds[j][1])
      const denom = pPlus[j] - pMinus[j]

      if (Math.abs(denom) < 1e-12) {
        for (let i = 0; i < n; i++) J[i][j] = 0
        continue
      }

      const rPlus = evaluateResiduals(pPlus, n)
      const rMinus = evaluateResiduals(pMinus, n)

      for (let i = 0; i < n; i++) {
        J[i][j] = (rPlus[i] - rMinus[i]) / denom
      }
    }
    return { J, r: r0 }
  }

  let ssr = calcSSR(params)
  let bestParams = [...params]
  let bestSSR = ssr

  for (let iter = 0; iter < maxIter; iter++) {
    const { J, r } = calcJacobian(params)
    const n = r.length

    // Compute J^T * J (2x2 matrix)
    const JTJ = [[0, 0], [0, 0]]
    for (let i = 0; i < n; i++) {
      JTJ[0][0] += J[i][0] * J[i][0]
      JTJ[0][1] += J[i][0] * J[i][1]
      JTJ[1][0] += J[i][1] * J[i][0]
      JTJ[1][1] += J[i][1] * J[i][1]
    }

    // Compute J^T * r (2x1 vector)
    const JTr = [0, 0]
    for (let i = 0; i < n; i++) {
      JTr[0] += J[i][0] * r[i]
      JTr[1] += J[i][1] * r[i]
    }

    // Try step with current lambda
    let stepAccepted = false
    for (let tryCount = 0; tryCount < 10; tryCount++) {
      // Add damping: (J^T*J + lambda*diag(J^T*J)) * delta = -J^T*r
      const A = [
        [JTJ[0][0] * (1 + lambda), JTJ[0][1]],
        [JTJ[1][0], JTJ[1][1] * (1 + lambda)]
      ]

      const delta = solve2x2(A, [-JTr[0], -JTr[1]])
      if (!delta) {
        lambda *= lambdaUp
        continue
      }

      // Apply bounds
      const newParams = clampParamsToBounds([
        params[0] + delta[0],
        params[1] + delta[1]
      ], bounds)

      const newSSR = calcSSR(newParams)

      if (newSSR < ssr) {
        // Accept step, decrease lambda (more Gauss-Newton)
        params = newParams
        ssr = newSSR
        lambda *= lambdaDown
        stepAccepted = true

        if (newSSR < bestSSR) {
          bestParams = [...newParams]
          bestSSR = newSSR
        }
        break
      } else {
        // Reject step, increase lambda (more gradient descent)
        lambda *= lambdaUp
      }
    }

    // Check convergence.
    // Do not stop immediately on a rejected iteration; LM can recover with a larger lambda.
    if (Math.sqrt(ssr / n) < tol) {
      break
    }
    if (!stepAccepted && lambda > 1e12) {
      break
    }
  }

  return { params: bestParams, ssr: bestSSR }
}

// Unified CdA/Crr solver using Levenberg-Marquardt
// Supports both Chung method (RMSE minimization) and Shen method (level + straight)
//
// method: 'chung' | 'shen'
//   - 'chung': Minimizes RMSE between virtual and actual elevation (standard VE method)
//   - 'shen': Minimizes net elevation change AND bow for CdA/Crr separation
//
export const solveCdaCrr = (
  data, si, ei, initialCda, initialCrr, mass, eff, rho, offset, wSpd, wDir,
  options = {}
) => {
  const { method = 'chung', fastMode = false, maxIterations = null } = options
  const cdaBounds = normalizeBounds(options.cdaBounds, DEFAULT_CDA_BOUNDS)
  const crrBounds = normalizeBounds(options.crrBounds, DEFAULT_CRR_BOUNDS)
  const bounds = [cdaBounds, crrBounds]
  const [fallbackCda, fallbackCrr] = clampParamsToBounds([initialCda, initialCrr], bounds)
  const len = getCommonSeriesLength(data)
  const range = normalizeRangeIndices(len, si, ei)

  if (!range) {
    const railingDetails = computeRailingDetails(fallbackCda, fallbackCrr, cdaBounds, crrBounds)
    return {
      cda: fallbackCda,
      crr: fallbackCrr,
      rmse: 0,
      bow: 0,
      netElev: 0,
      gradeVar: 0,
      speedVar: 0,
      avgSpeed: 0,
      bounds: { cda: cdaBounds, crr: crrBounds },
      isRailing: Object.values(railingDetails).some(Boolean),
      railingDetails
    }
  }

  const { ele } = data
  const { si: sIdx, ei: eIdx } = range
  const io = Math.round(Number.isFinite(offset) ? offset : 0)
  const wr = (Number.isFinite(wDir) ? wDir : 0) * (Math.PI / 180)
  const windSpeed = Number.isFinite(wSpd) ? wSpd : 0

  const { gradeVar, speedVar, avgSpeedKph } = computeSegmentStats(data, sIdx, eIdx)

  // Calculate virtual elevation profile for given CdA/Crr
  // ONLY uses data within selected range [si, ei) - treats it as standalone segment
  // Starts fresh at ele[si] so cropped region is analyzed independently
  const calcVirtualElevation = (tc, tr) => {
    const vEle = []
    let cur = safeArrayValue(ele, sIdx, 0)  // Start at GPS elevation of range start
    vEle.push(cur)

    for (let i = sIdx + 1; i < eIdx; i++) {
      cur += computeVeStepDelta(data, i, io, wr, mass, eff, rho, tc, tr, windSpeed)
      vEle.push(cur)
    }
    return vEle
  }

  // Chung method residuals: minimize (virtual_elevation - actual_elevation) for selected range
  const chungResidualFn = ([tc, tr]) => {
    const vEle = calcVirtualElevation(tc, tr)
    // vEle[k] corresponds to ele[si + k]
    return vEle.map((ve, k) => ve - safeArrayValue(ele, sIdx + k, ve))
  }

  // Shen method residuals: minimize net elevation AND bow
  // This separates CdA and Crr using speed-segregated data
  const shenResidualFn = ([tc, tr]) => {
    const vEle = calcVirtualElevation(tc, tr)
    const bow = calculateBow(vEle)
    const netElev = vEle[vEle.length - 1] - vEle[0]

    // Primary residuals: netElev and weighted bow
    const residuals = [netElev, bow * 3]

    // Add sampled elevation residuals for stability
    const step = Math.max(1, Math.floor(vEle.length / 10))
    for (let k = 0; k < vEle.length; k += step) {
      residuals.push((vEle[k] - safeArrayValue(ele, sIdx + k, vEle[k])) * 0.5)
    }

    return residuals
  }

  // Select residual function based on method
  const residualFn = method === 'shen' ? shenResidualFn : chungResidualFn

  // Multi-start LM optimization for robustness
  const seededStarts = fastMode ? [
    [initialCda, initialCrr],
    [0.28, 0.0045],
  ] : [
    [initialCda, initialCrr],
    [0.25, 0.004],
    [0.30, 0.005],
    [0.28, 0.0045],
    [0.22, 0.003],
  ]
  const startPoints = buildStartPoints(seededStarts, bounds)

  const maxIter = maxIterations ?? (fastMode ? 50 : 100)
  let globalBest = { cda: fallbackCda, crr: fallbackCrr, rmse: Infinity, cost: Infinity, bow: 0, netElev: 0 }

  for (const [startCda, startCrr] of startPoints) {
    const result = levenbergMarquardt(
      residualFn,
      [startCda, startCrr],
      bounds,
      { maxIter, finiteDiffStep: [1e-5, 1e-6] }
    )

    // Calculate metrics for this result
    const [fitCda, fitCrr] = clampParamsToBounds(result.params, bounds)
    const vEle = calcVirtualElevation(fitCda, fitCrr)
    // vEle[k] corresponds to ele[si + k], calculate RMSE
    let sqErr = 0
    for (let k = 0; k < vEle.length; k++) {
      const elev = safeArrayValue(ele, sIdx + k, vEle[k])
      sqErr += Math.pow(vEle[k] - elev, 2)
    }
    const rmse = Math.sqrt(sqErr / Math.max(1, vEle.length))
    const bow = calculateBow(vEle)
    const netElev = vEle[vEle.length - 1] - vEle[0]
    const cost = Math.abs(netElev) + Math.abs(bow) * 3
    if (!Number.isFinite(rmse) || !Number.isFinite(cost)) continue

    // Select best based on method
    const isBetter = method === 'shen'
      ? cost < globalBest.cost
      : rmse < globalBest.rmse

    if (isBetter) {
      globalBest = {
        cda: fitCda,
        crr: fitCrr,
        rmse,
        cost,
        bow,
        netElev
      }
    }
  }

  const railingDetails = computeRailingDetails(globalBest.cda, globalBest.crr, cdaBounds, crrBounds)
  const isRailing = Object.values(railingDetails).some(Boolean)

  return {
    cda: globalBest.cda,
    crr: globalBest.crr,
    rmse: globalBest.rmse,
    bow: globalBest.bow,
    netElev: globalBest.netElev,
    gradeVar,
    speedVar,
    avgSpeed: avgSpeedKph,
    bounds: { cda: cdaBounds, crr: crrBounds },
    isRailing,
    railingDetails
  }
}

// Calculate virtual elevation profile for given CdA/Crr
export const calculateVirtualElevation = (
  data, si, ei, cda, crr, mass, eff, rho, offset, wSpd, wDir
) => {
  const len = getCommonSeriesLength(data)
  const range = normalizeRangeIndices(len, si, ei)
  if (!range) return []

  const { ele } = data
  const { si: sIdx, ei: eIdx } = range
  const io = Math.round(Number.isFinite(offset) ? offset : 0)
  const wr = (Number.isFinite(wDir) ? wDir : 0) * (Math.PI / 180)
  const windSpeed = Number.isFinite(wSpd) ? wSpd : 0

  const vEle = []
  let cur = safeArrayValue(ele, sIdx, 0)
  vEle.push(cur)

  for (let i = sIdx + 1; i < eIdx; i++) {
    cur += computeVeStepDelta(data, i, io, wr, mass, eff, rho, cda, crr, windSpeed)
    vEle.push(cur)
  }

  return vEle
}

// Calculate bow (curvature) of virtual elevation plot for Shen method
// On an accelerating ride (low speeds left, high speeds right):
//   - Positive bow (middle above line) = Crr too LOW
//     (low Crr underestimates resistance at low speeds → appears as uphill on left)
//   - Negative bow (middle below line) = Crr too HIGH
//     (high Crr overestimates resistance at low speeds → appears as downhill on left)
export const calculateBow = (vEle) => {
  if (vEle.length < 10) return 0

  const n = vEle.length
  const start = vEle[0]
  const end = vEle[n - 1]
  const midIdx = Math.floor(n / 2)

  // Expected midpoint on a straight line
  const expectedMid = start + (end - start) * (midIdx / (n - 1))

  // Actual midpoint (average of middle section for stability)
  const midStart = Math.floor(n * 0.4)
  const midEnd = Math.floor(n * 0.6)
  let midSum = 0
  for (let i = midStart; i < midEnd; i++) {
    midSum += vEle[i]
  }
  const actualMid = midSum / (midEnd - midStart)

  return actualMid - expectedMid
}

// ============================================================================
// CLIMB METHOD (Two-Speed)
// ============================================================================
// Uses two GPX files from the same climb at different speeds.
// At low speed: Crr dominates (rolling resistance)
// At high speed: CdA dominates (aero drag scales with v²)
// By requiring both virtual elevations to match the same GPS elevation,
// we can better separate CdA and Crr.

export const solveCdaCrrClimb = (
  data1, si1, ei1,  // Low speed file
  data2, si2, ei2,  // High speed file
  initialCda, initialCrr,
  mass, eff, rho,
  offset1, offset2,
  wSpd, wDir,
  options = {}
) => {
  const { maxIterations = 500 } = options
  const cdaBounds = normalizeBounds(options.cdaBounds, DEFAULT_CDA_BOUNDS)
  const crrBounds = normalizeBounds(options.crrBounds, DEFAULT_CRR_BOUNDS)
  const bounds = [cdaBounds, crrBounds]
  const [fallbackCda, fallbackCrr] = clampParamsToBounds([initialCda, initialCrr], bounds)
  const range1 = normalizeRangeIndices(getCommonSeriesLength(data1), si1, ei1)
  const range2 = normalizeRangeIndices(getCommonSeriesLength(data2), si2, ei2)
  const wr = (Number.isFinite(wDir) ? wDir : 0) * (Math.PI / 180)
  const windSpeed = Number.isFinite(wSpd) ? wSpd : 0

  if (!range1 || !range2) {
    const railingDetails = computeRailingDetails(fallbackCda, fallbackCrr, cdaBounds, crrBounds)
    return {
      cda: fallbackCda,
      crr: fallbackCrr,
      rmse: 0,
      rmse1: 0,
      rmse2: 0,
      r2: 0,
      avgSpeed1: 0,
      avgSpeed2: 0,
      bounds: { cda: cdaBounds, crr: crrBounds },
      isRailing: Object.values(railingDetails).some(Boolean),
      railingDetails
    }
  }

  const { si: s1, ei: e1, n: n1 } = range1
  const { si: s2, ei: e2, n: n2 } = range2

  // Calculate virtual elevation for a given file
  // Uses same convention as display: vEle[0] = ele[si], then accumulate deltas
  const calcVE = (tc, tr, data, si, ei, offset) => {
    const { ele } = data
    const io = Math.round(Number.isFinite(offset) ? offset : 0)
    const vEle = []
    let cur = safeArrayValue(ele, si, 0)
    vEle.push(cur)  // vEle[0] = ele[si], no delta yet

    for (let i = si + 1; i < ei; i++) {
      cur += computeVeStepDelta(data, i, io, wr, mass, eff, rho, tc, tr, windSpeed)
      vEle.push(cur)
    }
    return vEle
  }

  // Combined residual function - concatenates residuals from both files
  const residualFn = ([tc, tr]) => {
    const vEle1 = calcVE(tc, tr, data1, s1, e1, offset1)
    const vEle2 = calcVE(tc, tr, data2, s2, e2, offset2)

    const res1 = vEle1.map((ve, i) => ve - safeArrayValue(data1.ele, s1 + i, ve))
    const res2 = vEle2.map((ve, i) => ve - safeArrayValue(data2.ele, s2 + i, ve))

    return [...res1, ...res2]  // LM minimizes combined RMSE
  }

  // Multi-start LM optimization
  const startPoints = buildStartPoints([
    [initialCda, initialCrr],
    [0.25, 0.004],
    [0.30, 0.005],
    [0.28, 0.0045],
    [0.22, 0.003],
  ], bounds)

  let globalBest = { cda: fallbackCda, crr: fallbackCrr, rmse: Infinity, rmse1: Infinity, rmse2: Infinity }

  for (const [startCda, startCrr] of startPoints) {
    const result = levenbergMarquardt(
      residualFn,
      [startCda, startCrr],
      bounds,
      { maxIter: maxIterations, finiteDiffStep: [1e-5, 1e-6] }
    )

    // Calculate metrics for this result
    const [fitCda, fitCrr] = clampParamsToBounds(result.params, bounds)
    const vEle1 = calcVE(fitCda, fitCrr, data1, s1, e1, offset1)
    const vEle2 = calcVE(fitCda, fitCrr, data2, s2, e2, offset2)

    // Calculate individual RMSEs
    let sqErr1 = 0
    for (let i = 0; i < vEle1.length; i++) {
      sqErr1 += Math.pow(vEle1[i] - safeArrayValue(data1.ele, s1 + i, vEle1[i]), 2)
    }
    const rmse1 = Math.sqrt(sqErr1 / Math.max(1, vEle1.length))

    let sqErr2 = 0
    for (let i = 0; i < vEle2.length; i++) {
      sqErr2 += Math.pow(vEle2[i] - safeArrayValue(data2.ele, s2 + i, vEle2[i]), 2)
    }
    const rmse2 = Math.sqrt(sqErr2 / Math.max(1, vEle2.length))

    // Combined RMSE (weighted by number of points)
    const totalPoints = Math.max(1, vEle1.length + vEle2.length)
    const rmse = Math.sqrt((sqErr1 + sqErr2) / totalPoints)
    if (!Number.isFinite(rmse)) continue

    if (rmse < globalBest.rmse) {
      globalBest = {
        cda: fitCda,
        crr: fitCrr,
        rmse,
        rmse1,
        rmse2
      }
    }
  }

  // Calculate R² for combined fit
  const vEle1 = calcVE(globalBest.cda, globalBest.crr, data1, s1, e1, offset1)
  const vEle2 = calcVE(globalBest.cda, globalBest.crr, data2, s2, e2, offset2)

  // Combined mean elevation
  let eleSum = 0
  for (let i = s1; i < e1; i++) eleSum += safeArrayValue(data1.ele, i, 0)
  for (let i = s2; i < e2; i++) eleSum += safeArrayValue(data2.ele, i, 0)
  const eleMean = eleSum / (n1 + n2)

  // Total sum of squares and residual sum of squares
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < vEle1.length; i++) {
    const elev = safeArrayValue(data1.ele, s1 + i, eleMean)
    ssTot += Math.pow(elev - eleMean, 2)
    ssRes += Math.pow(vEle1[i] - elev, 2)
  }
  for (let i = 0; i < vEle2.length; i++) {
    const elev = safeArrayValue(data2.ele, s2 + i, eleMean)
    ssTot += Math.pow(elev - eleMean, 2)
    ssRes += Math.pow(vEle2[i] - elev, 2)
  }
  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0

  // Calculate average speeds for each file
  const avgSpeed1 = data1.v.slice(s1, e1).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / Math.max(1, n1) * 3.6
  const avgSpeed2 = data2.v.slice(s2, e2).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / Math.max(1, n2) * 3.6
  const railingDetails = computeRailingDetails(globalBest.cda, globalBest.crr, cdaBounds, crrBounds)
  const isRailing = Object.values(railingDetails).some(Boolean)

  return {
    ...globalBest,
    r2,
    avgSpeed1,
    avgSpeed2,
    bounds: { cda: cdaBounds, crr: crrBounds },
    isRailing,
    railingDetails
  }
}

// ============================================================================
// SHEN METHOD (Dual Acceleration)
// ============================================================================
// The Shen method separates CdA and Crr using steadily accelerating/decelerating
// runs on FLAT ground. The key insight:
//   - Rolling resistance (Crr) is constant regardless of speed
//   - Aero drag (CdA) scales with velocity squared
//   - At low speeds, Crr dominates; at high speeds, CdA dominates
//
// If Crr/CdA are wrong, the virtual elevation will BOW:
//   - Crr too LOW (CdA compensated high) → plot bows UP
//   - Crr too HIGH (CdA compensated low) → plot bows DOWN
//
// The correct values make the virtual elevation BOTH:
//   1. LEVEL (net elevation change ≈ 0, since ground is flat)
//   2. STRAIGHT (no bow/curvature)
//
// Using two runs at different acceleration rates provides more constraint
// for solving the two unknowns (CdA and Crr).
// ============================================================================

export const solveCdaCrrShenDual = (
  data1, si1, ei1,  // Slow acceleration file
  data2, si2, ei2,  // Fast acceleration file
  initialCda, initialCrr,
  mass, eff, rho,
  offset1, offset2,
  wSpd, wDir,
  options = {}
) => {
  const { maxIterations = 500 } = options
  const cdaBounds = normalizeBounds(options.cdaBounds, DEFAULT_CDA_BOUNDS)
  const crrBounds = normalizeBounds(options.crrBounds, DEFAULT_CRR_BOUNDS)
  const bounds = [cdaBounds, crrBounds]
  const [fallbackCda, fallbackCrr] = clampParamsToBounds([initialCda, initialCrr], bounds)
  const range1 = normalizeRangeIndices(getCommonSeriesLength(data1), si1, ei1)
  const range2 = normalizeRangeIndices(getCommonSeriesLength(data2), si2, ei2)
  const wr = (Number.isFinite(wDir) ? wDir : 0) * (Math.PI / 180)
  const windSpeed = Number.isFinite(wSpd) ? wSpd : 0

  if (!range1 || !range2) {
    const railingDetails = computeRailingDetails(fallbackCda, fallbackCrr, cdaBounds, crrBounds)
    return {
      cda: fallbackCda,
      crr: fallbackCrr,
      bow1: 0,
      bow2: 0,
      netElev1: 0,
      netElev2: 0,
      avgSpeed1: 0,
      avgSpeed2: 0,
      bounds: { cda: cdaBounds, crr: crrBounds },
      isRailing: Object.values(railingDetails).some(Boolean),
      railingDetails
    }
  }

  const { si: s1, ei: e1, n: n1 } = range1
  const { si: s2, ei: e2, n: n2 } = range2

  // Calculate virtual elevation for a given file
  // Starts at 0 (arbitrary reference since ground is assumed flat)
  const calcVE = (tc, tr, data, si, ei, offset) => {
    const io = Math.round(Number.isFinite(offset) ? offset : 0)
    const vEle = []
    let cur = 0  // Start at 0 (flat ground reference)
    vEle.push(cur)  // vEle[0] = 0, no delta yet

    for (let i = si + 1; i < ei; i++) {
      cur += computeVeStepDelta(data, i, io, wr, mass, eff, rho, tc, tr, windSpeed)
      vEle.push(cur)
    }
    return vEle
  }

  // Residual function: minimize bow AND net elevation for both files
  // Key Shen criteria:
  //   1. Net elevation ≈ 0 (flat ground assumption)
  //   2. Bow ≈ 0 (straight line, no curvature)
  const residualFn = ([tc, tr]) => {
    const vEle1 = calcVE(tc, tr, data1, s1, e1, offset1)
    const vEle2 = calcVE(tc, tr, data2, s2, e2, offset2)

    // Bow calculations (deviation from straight line)
    const bow1 = calculateBow(vEle1)
    const bow2 = calculateBow(vEle2)

    // Net elevation change (should be ~0 on flat ground)
    const netElev1 = vEle1[vEle1.length - 1] - vEle1[0]
    const netElev2 = vEle2[vEle2.length - 1] - vEle2[0]

    // Weighted residuals:
    // - Bow weighted heavily (x5) - key criterion for Crr/CdA separation
    // - Net elevation weighted (x3) - ensures flat ground assumption holds
    return [
      bow1 * 5,
      bow2 * 5,
      netElev1 * 3,
      netElev2 * 3
    ]
  }

  // Multi-start LM optimization
  const startPoints = buildStartPoints([
    [initialCda, initialCrr],
    [0.25, 0.004],
    [0.30, 0.005],
    [0.28, 0.0045],
    [0.22, 0.003],
  ], bounds)

  let globalBest = {
    cda: fallbackCda,
    crr: fallbackCrr,
    cost: Infinity,
    bow1: Infinity,
    bow2: Infinity,
    netElev1: Infinity,
    netElev2: Infinity
  }

  for (const [startCda, startCrr] of startPoints) {
    const result = levenbergMarquardt(
      residualFn,
      [startCda, startCrr],
      bounds,
      { maxIter: maxIterations, finiteDiffStep: [1e-5, 1e-6] }
    )

    // Calculate metrics for this result
    const [fitCda, fitCrr] = clampParamsToBounds(result.params, bounds)
    const vEle1 = calcVE(fitCda, fitCrr, data1, s1, e1, offset1)
    const vEle2 = calcVE(fitCda, fitCrr, data2, s2, e2, offset2)

    const bow1 = calculateBow(vEle1)
    const bow2 = calculateBow(vEle2)
    const netElev1 = vEle1[vEle1.length - 1] - vEle1[0]
    const netElev2 = vEle2[vEle2.length - 1] - vEle2[0]

    // Cost: prioritize low bow, then low net elevation
    const cost = Math.abs(bow1) + Math.abs(bow2) + Math.abs(netElev1) * 0.3 + Math.abs(netElev2) * 0.3
    if (!Number.isFinite(cost)) continue

    if (cost < globalBest.cost) {
      globalBest = {
        cda: fitCda,
        crr: fitCrr,
        cost,
        bow1,
        bow2,
        netElev1,
        netElev2
      }
    }
  }

  // Calculate average speeds for each file
  const avgSpeed1 = data1.v.slice(s1, e1).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / Math.max(1, n1) * 3.6
  const avgSpeed2 = data2.v.slice(s2, e2).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / Math.max(1, n2) * 3.6
  const railingDetails = computeRailingDetails(globalBest.cda, globalBest.crr, cdaBounds, crrBounds)
  const isRailing = Object.values(railingDetails).some(Boolean)

  return {
    cda: globalBest.cda,
    crr: globalBest.crr,
    bow1: globalBest.bow1,
    bow2: globalBest.bow2,
    netElev1: globalBest.netElev1,
    netElev2: globalBest.netElev2,
    avgSpeed1,
    avgSpeed2,
    bounds: { cda: cdaBounds, crr: crrBounds },
    isRailing,
    railingDetails
  }
}

// ============================================================================
// SWEEP METHOD (2D CdA/Crr Solution Space)
// ============================================================================
// With single-ride Chung analysis, CdA and Crr are often degenerate:
// Higher CdA + Lower Crr ≈ Lower CdA + Higher Crr (similar RMSE)
//
// This sweep method visualizes the FULL 2D solution space by:
// 1. Sweeping both CdA and Crr across their ranges
// 2. Computing RMSE for each (CdA, Crr) combination
// 3. Displaying as a heatmap to show the "valley" of good solutions
//
// Users can then apply prior knowledge (e.g., "I know my Crr is ~0.004")
// to narrow down the CdA value by looking at where that Crr intersects
// the low-RMSE region.
// ============================================================================

// Compute RMSE for a given CdA/Crr combination (optimized for batch calls)
// ONLY uses data within selected range [si, ei) - treats it as standalone segment
const computeRMSE = (data, si, ei, cda, crr, mass, eff, rho, offset, wSpd, wDir) => {
  const { ele } = data
  const n = ei - si
  if (n < 2) return Infinity
  const io = Math.round(Number.isFinite(offset) ? offset : 0)
  const wr = (Number.isFinite(wDir) ? wDir : 0) * (Math.PI / 180)
  const windSpeed = Number.isFinite(wSpd) ? wSpd : 0

  // Start fresh at GPS elevation of range start
  let cur = safeArrayValue(ele, si, 0)
  let sqErr = 0

  // First point: vEle = ele[si], error = 0
  for (let i = si + 1; i < ei; i++) {
    cur += computeVeStepDelta(data, i, io, wr, mass, eff, rho, cda, crr, windSpeed)
    sqErr += Math.pow(cur - safeArrayValue(ele, i, cur), 2)
  }

  return Math.sqrt(sqErr / Math.max(1, n - 1))
}

// Main sweep solver - generates 2D CdA/Crr solution space
// Returns a Promise to allow progress updates during computation
export const solveCdaCrrSweep = (
  data, si, ei, mass, eff, rho, offset, wSpd, wDir,
  options = {}
) => {
  const {
    cdaMin = 0.10,
    cdaMax = 0.60,
    cdaSteps = 70,
    crrMin = 0.001,
    crrMax = 0.020,
    crrSteps = 70,
    onProgress = null  // Progress callback: (percent, currentRow, totalRows) => void
  } = options
  const len = getCommonSeriesLength(data)
  const range = normalizeRangeIndices(len, si, ei)
  if (!range) {
    return Promise.resolve({
      cdaValues: [],
      crrValues: [],
      rmseGrid: [],
      best: null,
      minRmse: 0,
      maxRmse: 0,
      cdaRange: [cdaMin, cdaMax],
      crrRange: [crrMin, crrMax]
    })
  }

  const { si: sIdx, ei: eIdx, n } = range
  const cdaLo = Math.min(cdaMin, cdaMax)
  const cdaHi = Math.max(cdaMin, cdaMax)
  const crrLo = Math.min(crrMin, crrMax)
  const crrHi = Math.max(crrMin, crrMax)
  const cdaStepCount = Math.max(1, Math.floor(cdaSteps))
  const crrStepCount = Math.max(1, Math.floor(crrSteps))

  return new Promise((resolve) => {
    // Create grid of CdA and Crr values
    const cdaValues = []
    const crrValues = []

    for (let i = 0; i <= cdaStepCount; i++) {
      cdaValues.push(cdaLo + (i / cdaStepCount) * (cdaHi - cdaLo))
    }
    for (let j = 0; j <= crrStepCount; j++) {
      crrValues.push(crrLo + (j / crrStepCount) * (crrHi - crrLo))
    }

    // Compute RMSE for each (CdA, Crr) combination
    const rmseGrid = []
    let bestSolution = null
    let bestRmse = Infinity
    let minRmse = Infinity
    let maxRmse = 0

    let currentRow = 0
    const totalRows = cdaStepCount + 1

    // Process rows in chunks to allow UI updates
    const processChunk = () => {
      const chunkSize = 5  // Process 5 rows per frame
      const endRow = Math.min(currentRow + chunkSize, totalRows)

      for (let i = currentRow; i < endRow; i++) {
        const row = []
        for (let j = 0; j <= crrStepCount; j++) {
          const rmse = computeRMSE(data, sIdx, eIdx, cdaValues[i], crrValues[j], mass, eff, rho, offset, wSpd, wDir)
          row.push(rmse)

          minRmse = Math.min(minRmse, rmse)
          maxRmse = Math.max(maxRmse, rmse)

          if (rmse < bestRmse) {
            bestRmse = rmse
            bestSolution = { cda: cdaValues[i], crr: crrValues[j], rmse }
          }
        }
        rmseGrid.push(row)
      }

      currentRow = endRow

      // Report progress
      if (onProgress) {
        const percent = Math.round((currentRow / totalRows) * 100)
        onProgress(percent, currentRow, totalRows)
      }

      if (currentRow < totalRows) {
        // Continue processing after allowing UI to update
        setTimeout(processChunk, 0)
      } else {
        // Done - compute R² for best solution and resolve
        if (bestSolution) {
          let eleSum = 0
          for (let i = sIdx; i < eIdx; i++) eleSum += safeArrayValue(data.ele, i, 0)
          const eleMean = eleSum / Math.max(1, n)

          let ssTot = 0
          for (let i = sIdx; i < eIdx; i++) {
            ssTot += Math.pow(safeArrayValue(data.ele, i, eleMean) - eleMean, 2)
          }

          const ssRes = bestRmse * bestRmse * Math.max(1, n - 1)
          bestSolution.r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0
        }

        resolve({
          cdaValues,
          crrValues,
          rmseGrid,
          best: bestSolution,
          minRmse,
          maxRmse,
          cdaRange: [cdaLo, cdaHi],
          crrRange: [crrLo, crrHi]
        })
      }
    }

    // Start processing
    processChunk()
  })
}

// Check if ride has steady acceleration (suitable for Shen method)
export const checkSteadyAcceleration = (data, si, ei) => {
  const { v } = data
  const speeds = v.slice(si, ei)

  if (speeds.length < 20) return { suitable: false, reason: 'Not enough data points', score: 0 }

  // Calculate linear regression of speed over time
  const n = speeds.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += speeds[i]
    sumXY += i * speeds[i]
    sumX2 += i * i
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R² to measure linearity of speed change
  let ssRes = 0, ssTot = 0
  const meanSpeed = sumY / n

  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept
    ssRes += Math.pow(speeds[i] - predicted, 2)
    ssTot += Math.pow(speeds[i] - meanSpeed, 2)
  }

  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0

  // Speed change should be significant (at least 3 m/s change)
  const speedChange = Math.abs(speeds[n - 1] - speeds[0])
  const hasSignificantChange = speedChange > 3

  // R² should be at least 0.5 for reasonable linearity
  const isLinear = r2 > 0.5

  const direction = slope > 0 ? 'accelerating' : 'decelerating'
  const score = r2 * Math.min(1, speedChange / 5) // Score 0-1 based on linearity and magnitude

  if (!hasSignificantChange) {
    return { suitable: false, reason: 'Speed change too small (need >3 m/s)', score, r2, speedChange, direction }
  }

  if (!isLinear) {
    return { suitable: false, reason: 'Speed change not steady enough', score, r2, speedChange, direction }
  }

  return { suitable: true, reason: `Good ${direction} profile`, score, r2, speedChange, direction }
}

// ============================================================================
// ROUTE SIMULATION - Time-step based physics for accurate time estimation
// ============================================================================

// Calculate net force on rider at given velocity and conditions
// Returns force in Newtons (positive = accelerating, negative = decelerating)
export const calculateNetForce = (power, velocity, grade, mass, cda, crr, rho, eff, elevation = 0, windSpeed = 0) => {
  void elevation // Retained for backward-compatible signature.
  // Minimum velocity to avoid division by zero
  const v = Math.max(0.5, velocity)

  // Propulsive force from pedaling
  const wheelPower = power * eff
  const F_propulsion = wheelPower / v

  // Grade angle
  const theta = Math.atan(grade / 100)

  // Gravitational force (positive when going uphill)
  const F_gravity = mass * GRAVITY * Math.sin(theta)

  // Rolling resistance (always opposes motion)
  const F_rolling = mass * GRAVITY * crr * Math.cos(theta)

  // Aerodynamic drag
  // Apparent air velocity = ground velocity + headwind (positive = headwind)
  const v_air = v + windSpeed
  const F_aero = 0.5 * rho * cda * v_air * Math.abs(v_air)

  // Net force: propulsion minus all resistance
  const F_net = F_propulsion - F_gravity - F_rolling - F_aero

  return F_net
}

// Get gradient and elevation at any position along route via interpolation
export const getGradientAtPosition = (routeData, position) => {
  if (!routeData || !Array.isArray(routeData.segments) || routeData.segments.length === 0) {
    return { grade: 0, elevation: 0, bearing: 0 }
  }

  const { segments, cumDist } = routeData

  // Handle edge cases
  if (position <= 0) {
    const seg = segments[0]
    return { grade: seg.g, elevation: seg.ele, bearing: seg.bearing ?? 0 }
  }
  if (position >= routeData.totalDist) {
    const last = segments[segments.length - 1]
    return { grade: last.g, elevation: last.ele, bearing: last.bearing ?? 0 }
  }

  // Binary search to find the segment containing this position
  let lo = 0, hi = cumDist.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (cumDist[mid] < position) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  // lo is now the index of first cumDist >= position
  const segIdx = Math.max(0, lo - 1)
  const seg = segments[segIdx]

  // Get bearing for wind calculations (if available)
  const bearing = seg.bearing !== undefined ? seg.bearing : 0

  return {
    grade: seg.g,
    elevation: seg.ele,
    bearing: bearing
  }
}

// Main route simulation using time-step integration
// Models realistic rider behavior with momentum, coasting, and speed limits
export const simulateRoute = (routeData, config) => {
  if (!routeData || !Array.isArray(routeData.segments) || routeData.segments.length === 0 || !Number.isFinite(routeData.totalDist) || routeData.totalDist <= 0) {
    return {
      time: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      coastingTime: 0,
      coastingPercent: 0,
      distance: 0,
      completed: false
    }
  }

  const {
    power,
    mass,
    cda,
    crr,
    rho,
    eff,
    windSpeed = 0,
    windDir = 0,      // Wind direction in degrees (0 = from North)
    options = {}
  } = config

  // Simulation options with defaults
  const {
    maxAccel = 1.0,           // m/s² - max acceleration
    maxDecel = 2.0,           // m/s² - max deceleration (braking + aero)
    maxDescentSpeed = 70/3.6, // m/s - hard speed limit (braking)
    coastSpeed = 45/3.6,      // m/s - coast (0W) above this speed
    minClimbSpeed = 5/3.6,    // m/s - minimum speed on climbs
    timeStep = 0.5            // seconds per simulation step
  } = options

  const dt = timeStep
  let velocity = 1.0  // Start at 1 m/s (rolling start)
  let position = 0
  let time = 0
  let coastingTime = 0
  let maxSpeedReached = 0

  // Wind direction in radians
  const windDirRad = windDir * (Math.PI / 180)

  // Safety limit for simulation (prevent infinite loops)
  const maxTime = 24 * 3600 // 24 hours max

  while (position < routeData.totalDist && time < maxTime) {
    // 1. Get gradient and bearing at current position
    const { grade, elevation, bearing } = getGradientAtPosition(routeData, position)

    // 2. Calculate effective wind speed based on bearing
    // Wind component in direction of travel (positive = headwind)
    let effectiveWind = 0
    if (windSpeed !== 0 && bearing !== undefined) {
      const bearingRad = bearing * (Math.PI / 180)
      // Wind blowing FROM windDir, so headwind when bearing matches windDir
      effectiveWind = windSpeed * Math.cos(bearingRad - windDirRad)
    }

    // 3. Determine effective power (coast if above coast speed)
    let effectivePower = power
    let isCoasting = false
    if (velocity > coastSpeed) {
      effectivePower = 0
      isCoasting = true
    }

    // 4. Calculate net force at current velocity
    const F_net = calculateNetForce(
      effectivePower, velocity, grade, mass, cda, crr, rho, eff, elevation, effectiveWind
    )

    // 5. Calculate acceleration with limits
    let accel = F_net / mass
    accel = Math.max(-maxDecel, Math.min(maxAccel, accel))

    // 6. Apply max descent speed limit (force braking)
    if (velocity > maxDescentSpeed) {
      // Gradual braking to get back under limit
      accel = Math.min(accel, -1.0)
    }

    // 7. Update velocity
    velocity = Math.max(0.1, velocity + accel * dt)

    // 8. Apply minimum speed on climbs (don't go below walking pace)
    if (grade > 0 && velocity < minClimbSpeed) {
      velocity = minClimbSpeed
    }

    // 9. Track statistics
    maxSpeedReached = Math.max(maxSpeedReached, velocity)

    // 10. Update position and time. Use partial final step to avoid finish-time bias.
    const remainingDist = routeData.totalDist - position
    const stepDist = velocity * dt
    const stepTime = stepDist > remainingDist ? (remainingDist / Math.max(velocity, 0.1)) : dt
    const actualStepDist = Math.min(stepDist, remainingDist)

    if (isCoasting) coastingTime += stepTime

    position += actualStepDist
    time += stepTime
  }

  const completed = position >= routeData.totalDist - 1e-6
  const distanceCovered = Math.min(position, routeData.totalDist)
  const finalTime = completed ? time : Infinity

  return {
    time: finalTime,
    avgSpeed: completed && time > 0 ? routeData.totalDist / time : 0,
    maxSpeed: maxSpeedReached,
    coastingTime,
    coastingPercent: time > 0 ? (coastingTime / time) * 100 : 0,
    distance: distanceCovered,
    completed
  }
}
