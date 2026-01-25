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
// windSpeed in m/s, positive = headwind, negative = tailwind
export const solveVelocity = (watts, grade, mass, cda, crr, rho, eff, elev = 0, windSpeed = 0) => {
  const wheelPwr = watts * eff
  const theta = Math.atan(grade / 100)
  const fRes = mass * GRAVITY * (Math.sin(theta) + crr * Math.cos(theta))

  // Adjust rho for altitude if elevation is provided
  let localRho = rho
  if (typeof elev === 'number' && elev > 0) {
    localRho = rho * Math.exp(-elev / 9000)
  }

  const K = 0.5 * localRho * cda

  // Newton-Raphson solver with wind
  // Air velocity = ground velocity + headwind component
  let v = 10
  for (let i = 0; i < 15; i++) {
    const va = v + windSpeed // apparent air velocity
    const fAero = K * va * Math.abs(va) // drag force (preserves sign)
    const f = fAero * v + fRes * v - wheelPwr
    const df = K * (2 * va * v + va * Math.abs(va) / Math.max(0.1, v)) + fRes
    if (Math.abs(df) < 1e-6) break
    const step = f / df
    v = v - step
    if (v < 0.1) v = 0.1
  }
  return Math.max(0, v)
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

  let params = [...params0]
  let lambda = lambdaInit

  // Calculate sum of squared residuals
  const calcSSR = (p) => {
    const r = residualFn(p)
    return r.reduce((sum, ri) => sum + ri * ri, 0)
  }

  // Calculate Jacobian numerically (2 columns for CdA, Crr)
  const calcJacobian = (p) => {
    const r0 = residualFn(p)
    const n = r0.length
    const J = Array(n).fill(null).map(() => [0, 0])

    for (let j = 0; j < 2; j++) {
      const h = finiteDiffStep[j]
      const pPlus = [...p]
      pPlus[j] += h
      const rPlus = residualFn(pPlus)

      for (let i = 0; i < n; i++) {
        J[i][j] = (rPlus[i] - r0[i]) / h
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
      let newParams = [
        Math.max(bounds[0][0], Math.min(bounds[0][1], params[0] + delta[0])),
        Math.max(bounds[1][0], Math.min(bounds[1][1], params[1] + delta[1]))
      ]

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

    // Check convergence
    if (!stepAccepted || Math.sqrt(ssr / n) < tol) {
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
  { method = 'chung', fastMode = false, maxIterations = null } = {}
) => {
  const { pwr, v, a, ds, ele, b } = data
  const io = Math.round(offset)
  const wr = wDir * (Math.PI / 180)
  const n = ei - si

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
  let gradeVar = 0
  if (grades.length > 1) {
    const gradeMean = grades.reduce((a, b) => a + b, 0) / grades.length
    gradeVar = grades.reduce((sum, g) => sum + Math.pow(g - gradeMean, 2), 0) / grades.length
  }

  // Speed variance
  const avgSpeed = segV.reduce((a, b) => a + b, 0) / segV.length
  const speedVar = segV.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / segV.length
  const avgSpeedKph = avgSpeed * 3.6

  // Calculate virtual elevation profile for given CdA/Crr
  const calcVirtualElevation = (tc, tr) => {
    const vEle = []
    let cur = ele[si]

    for (let i = si; i < ei; i++) {
      const vg = Math.max(0.1, v[i])
      let pi = i - io
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1
      const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wr)
      const localRho = rho * Math.exp(-ele[i] / 9000)
      const f = (pwr[pi] * eff / vg) - (mass * GRAVITY * tr) - (mass * a[i]) - (0.5 * localRho * tc * va * va * Math.sign(va))
      cur += (f / (mass * GRAVITY)) * ds[i]
      vEle.push(cur)
    }
    return vEle
  }

  // Chung method residuals: minimize (virtual_elevation - actual_elevation) for each point
  const chungResidualFn = ([tc, tr]) => {
    const vEle = calcVirtualElevation(tc, tr)
    return vEle.map((ve, i) => ve - ele[si + i])
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
    for (let i = 0; i < vEle.length; i += step) {
      residuals.push((vEle[i] - ele[si + i]) * 0.5)
    }

    return residuals
  }

  // Select residual function based on method
  const residualFn = method === 'shen' ? shenResidualFn : chungResidualFn

  // Parameter bounds: CdA [0.1, 0.6], Crr [0.001, 0.015]
  const bounds = [[0.1, 0.6], [0.001, 0.015]]

  // Multi-start LM optimization for robustness
  const startPoints = fastMode ? [
    [initialCda, initialCrr],
    [0.28, 0.0045],
  ] : [
    [initialCda, initialCrr],
    [0.25, 0.004],
    [0.30, 0.005],
    [0.28, 0.0045],
    [0.22, 0.003],
  ]

  const maxIter = maxIterations ?? (fastMode ? 50 : 100)
  let globalBest = { cda: initialCda, crr: initialCrr, rmse: Infinity, cost: Infinity, bow: 0, netElev: 0 }

  for (const [startCda, startCrr] of startPoints) {
    const result = levenbergMarquardt(
      residualFn,
      [startCda, startCrr],
      bounds,
      { maxIter, finiteDiffStep: [1e-5, 1e-6] }
    )

    // Calculate metrics for this result
    const vEle = calcVirtualElevation(result.params[0], result.params[1])
    let sqErr = 0
    for (let i = 0; i < vEle.length; i++) {
      sqErr += Math.pow(vEle[i] - ele[si + i], 2)
    }
    const rmse = Math.sqrt(sqErr / n)
    const bow = calculateBow(vEle)
    const netElev = vEle[vEle.length - 1] - vEle[0]
    const cost = Math.abs(netElev) + Math.abs(bow) * 3

    // Select best based on method
    const isBetter = method === 'shen'
      ? cost < globalBest.cost
      : rmse < globalBest.rmse

    if (isBetter) {
      globalBest = {
        cda: result.params[0],
        crr: result.params[1],
        rmse,
        cost,
        bow,
        netElev
      }
    }
  }

  const quality = (1 / (1 + globalBest.rmse)) * (1 + Math.sqrt(gradeVar)) * (1 + Math.sqrt(speedVar) * 0.5)

  return {
    cda: globalBest.cda,
    crr: globalBest.crr,
    rmse: globalBest.rmse,
    bow: globalBest.bow,
    netElev: globalBest.netElev,
    gradeVar,
    speedVar,
    avgSpeed: avgSpeedKph,
    quality
  }
}

// Calculate virtual elevation profile for given CdA/Crr
export const calculateVirtualElevation = (
  data, si, ei, cda, crr, mass, eff, rho, offset, wSpd, wDir
) => {
  const { pwr, v, a, ds, ele, b } = data
  const io = Math.round(offset)
  const wr = wDir * (Math.PI / 180)

  const vEle = []
  let cur = ele[si]

  for (let i = si; i < ei; i++) {
    const vg = Math.max(0.1, v[i])
    let pi = i - io
    if (pi < 0) pi = 0
    if (pi >= pwr.length) pi = pwr.length - 1
    const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wr)
    const f = (pwr[pi] * eff / vg) - (mass * GRAVITY * crr) - (mass * a[i]) - (0.5 * (rho * Math.exp(-ele[i] / 9000)) * cda * va * va * Math.sign(va))
    cur += (f / (mass * GRAVITY)) * ds[i]
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
  { maxIterations = 500 } = {}
) => {
  const wr = wDir * (Math.PI / 180)
  const n1 = ei1 - si1
  const n2 = ei2 - si2

  // Calculate virtual elevation for a given file
  const calcVE = (tc, tr, data, si, ei, offset) => {
    const { pwr, v, a, ds, ele, b } = data
    const io = Math.round(offset)
    const vEle = []
    let cur = ele[si]

    for (let i = si; i < ei; i++) {
      const vg = Math.max(0.1, v[i])
      let pi = i - io
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1
      const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wr)
      const localRho = rho * Math.exp(-ele[i] / 9000)
      const f = (pwr[pi] * eff / vg) - (mass * GRAVITY * tr) - (mass * a[i]) - (0.5 * localRho * tc * va * va * Math.sign(va))
      cur += (f / (mass * GRAVITY)) * ds[i]
      vEle.push(cur)
    }
    return vEle
  }

  // Combined residual function - concatenates residuals from both files
  const residualFn = ([tc, tr]) => {
    const vEle1 = calcVE(tc, tr, data1, si1, ei1, offset1)
    const vEle2 = calcVE(tc, tr, data2, si2, ei2, offset2)

    const res1 = vEle1.map((ve, i) => ve - data1.ele[si1 + i])
    const res2 = vEle2.map((ve, i) => ve - data2.ele[si2 + i])

    return [...res1, ...res2]  // LM minimizes combined RMSE
  }

  // Parameter bounds: CdA [0.1, 0.6], Crr [0.001, 0.015]
  const bounds = [[0.1, 0.6], [0.001, 0.015]]

  // Multi-start LM optimization
  const startPoints = [
    [initialCda, initialCrr],
    [0.25, 0.004],
    [0.30, 0.005],
    [0.28, 0.0045],
    [0.22, 0.003],
  ]

  let globalBest = { cda: initialCda, crr: initialCrr, rmse: Infinity, rmse1: Infinity, rmse2: Infinity }

  for (const [startCda, startCrr] of startPoints) {
    const result = levenbergMarquardt(
      residualFn,
      [startCda, startCrr],
      bounds,
      { maxIter: maxIterations, finiteDiffStep: [1e-5, 1e-6] }
    )

    // Calculate metrics for this result
    const vEle1 = calcVE(result.params[0], result.params[1], data1, si1, ei1, offset1)
    const vEle2 = calcVE(result.params[0], result.params[1], data2, si2, ei2, offset2)

    // Calculate individual RMSEs
    let sqErr1 = 0
    for (let i = 0; i < vEle1.length; i++) {
      sqErr1 += Math.pow(vEle1[i] - data1.ele[si1 + i], 2)
    }
    const rmse1 = Math.sqrt(sqErr1 / n1)

    let sqErr2 = 0
    for (let i = 0; i < vEle2.length; i++) {
      sqErr2 += Math.pow(vEle2[i] - data2.ele[si2 + i], 2)
    }
    const rmse2 = Math.sqrt(sqErr2 / n2)

    // Combined RMSE (weighted by number of points)
    const totalPoints = n1 + n2
    const rmse = Math.sqrt((sqErr1 + sqErr2) / totalPoints)

    if (rmse < globalBest.rmse) {
      globalBest = {
        cda: result.params[0],
        crr: result.params[1],
        rmse,
        rmse1,
        rmse2
      }
    }
  }

  // Calculate R² for combined fit
  const vEle1 = calcVE(globalBest.cda, globalBest.crr, data1, si1, ei1, offset1)
  const vEle2 = calcVE(globalBest.cda, globalBest.crr, data2, si2, ei2, offset2)

  // Combined mean elevation
  let eleSum = 0
  for (let i = si1; i < ei1; i++) eleSum += data1.ele[i]
  for (let i = si2; i < ei2; i++) eleSum += data2.ele[i]
  const eleMean = eleSum / (n1 + n2)

  // Total sum of squares and residual sum of squares
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < vEle1.length; i++) {
    ssTot += Math.pow(data1.ele[si1 + i] - eleMean, 2)
    ssRes += Math.pow(vEle1[i] - data1.ele[si1 + i], 2)
  }
  for (let i = 0; i < vEle2.length; i++) {
    ssTot += Math.pow(data2.ele[si2 + i] - eleMean, 2)
    ssRes += Math.pow(vEle2[i] - data2.ele[si2 + i], 2)
  }
  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0

  // Calculate average speeds for each file
  const avgSpeed1 = data1.v.slice(si1, ei1).reduce((a, b) => a + b, 0) / n1 * 3.6
  const avgSpeed2 = data2.v.slice(si2, ei2).reduce((a, b) => a + b, 0) / n2 * 3.6

  return {
    ...globalBest,
    r2,
    avgSpeed1,
    avgSpeed2
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
  { maxIterations = 500 } = {}
) => {
  const wr = wDir * (Math.PI / 180)
  const n1 = ei1 - si1
  const n2 = ei2 - si2

  // Calculate virtual elevation for a given file
  // Starts at 0 (arbitrary reference since ground is assumed flat)
  const calcVE = (tc, tr, data, si, ei, offset) => {
    const { pwr, v, a, ds, ele, b } = data
    const io = Math.round(offset)
    const vEle = []
    let cur = 0  // Start at 0 (flat ground reference)

    for (let i = si; i < ei; i++) {
      const vg = Math.max(0.1, v[i])
      let pi = i - io
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1
      const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wr)
      const localRho = rho * Math.exp(-ele[i] / 9000)
      const f = (pwr[pi] * eff / vg) - (mass * GRAVITY * tr) - (mass * a[i]) - (0.5 * localRho * tc * va * va * Math.sign(va))
      cur += (f / (mass * GRAVITY)) * ds[i]
      vEle.push(cur)
    }
    return vEle
  }

  // Residual function: minimize bow AND net elevation for both files
  // Key Shen criteria:
  //   1. Net elevation ≈ 0 (flat ground assumption)
  //   2. Bow ≈ 0 (straight line, no curvature)
  const residualFn = ([tc, tr]) => {
    const vEle1 = calcVE(tc, tr, data1, si1, ei1, offset1)
    const vEle2 = calcVE(tc, tr, data2, si2, ei2, offset2)

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

  // Parameter bounds: CdA [0.1, 0.6], Crr [0.001, 0.015]
  const bounds = [[0.1, 0.6], [0.001, 0.015]]

  // Multi-start LM optimization
  const startPoints = [
    [initialCda, initialCrr],
    [0.25, 0.004],
    [0.30, 0.005],
    [0.28, 0.0045],
    [0.22, 0.003],
  ]

  let globalBest = {
    cda: initialCda,
    crr: initialCrr,
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
    const vEle1 = calcVE(result.params[0], result.params[1], data1, si1, ei1, offset1)
    const vEle2 = calcVE(result.params[0], result.params[1], data2, si2, ei2, offset2)

    const bow1 = calculateBow(vEle1)
    const bow2 = calculateBow(vEle2)
    const netElev1 = vEle1[vEle1.length - 1] - vEle1[0]
    const netElev2 = vEle2[vEle2.length - 1] - vEle2[0]

    // Cost: prioritize low bow, then low net elevation
    const cost = Math.abs(bow1) + Math.abs(bow2) + Math.abs(netElev1) * 0.3 + Math.abs(netElev2) * 0.3

    if (cost < globalBest.cost) {
      globalBest = {
        cda: result.params[0],
        crr: result.params[1],
        cost,
        bow1,
        bow2,
        netElev1,
        netElev2
      }
    }
  }

  // Calculate average speeds for each file
  const avgSpeed1 = data1.v.slice(si1, ei1).reduce((a, b) => a + b, 0) / n1 * 3.6
  const avgSpeed2 = data2.v.slice(si2, ei2).reduce((a, b) => a + b, 0) / n2 * 3.6

  return {
    cda: globalBest.cda,
    crr: globalBest.crr,
    bow1: globalBest.bow1,
    bow2: globalBest.bow2,
    netElev1: globalBest.netElev1,
    netElev2: globalBest.netElev2,
    avgSpeed1,
    avgSpeed2
  }
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

  // Air density adjusted for altitude
  let localRho = rho
  if (elevation > 0) {
    localRho = rho * Math.exp(-elevation / 9000)
  }

  // Aerodynamic drag
  // Apparent air velocity = ground velocity + headwind (positive = headwind)
  const v_air = v + windSpeed
  const F_aero = 0.5 * localRho * cda * v_air * Math.abs(v_air)

  // Net force: propulsion minus all resistance
  const F_net = F_propulsion - F_gravity - F_rolling - F_aero

  return F_net
}

// Get gradient and elevation at any position along route via interpolation
export const getGradientAtPosition = (routeData, position) => {
  const { segments, cumDist } = routeData

  // Handle edge cases
  if (position <= 0) {
    return { grade: segments[0].g, elevation: segments[0].ele }
  }
  if (position >= routeData.totalDist) {
    const last = segments[segments.length - 1]
    return { grade: last.g, elevation: last.ele }
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
    if (windSpeed > 0 && bearing !== undefined) {
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
    velocity = velocity + accel * dt

    // 8. Apply minimum speed on climbs (don't go below walking pace)
    if (velocity < minClimbSpeed) {
      velocity = minClimbSpeed
    }

    // 9. Track statistics
    maxSpeedReached = Math.max(maxSpeedReached, velocity)
    if (isCoasting) coastingTime += dt

    // 10. Update position and time
    position += velocity * dt
    time += dt
  }

  return {
    time,
    avgSpeed: routeData.totalDist / time,
    maxSpeed: maxSpeedReached,
    coastingTime,
    coastingPercent: time > 0 ? (coastingTime / time) * 100 : 0,
    distance: routeData.totalDist
  }
}
