import { useState, useMemo, useCallback, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import { parseActivityFile } from '../../lib/gpxParser'
import { solveCdaCrr, solveCdaCrrClimb, solveCdaCrrShenDual, solveCdaCrrSweep, calculateBow, safeNum, GRAVITY } from '../../lib/physics'
import { lowPassFilter } from '../../lib/preprocessing'
import { calculateAirDensity } from '../../lib/airDensity'
import { SavePresetModal } from '../presets'
import { AlertDialog } from '../ui'

export const QuickTestTab = ({ presetsHook }) => {
  const { user } = useAuth()
  const { isFeatureEnabled } = useFeatureFlags()

  // Check which methods are available
  const hasShenMethod = isFeatureEnabled('method_shen')
  const hasClimbMethod = isFeatureEnabled('method_climb')
  const hasSweepMethod = isFeatureEnabled('method_sweep')
  const hasAnyExtraMethod = hasShenMethod || hasClimbMethod || hasSweepMethod
  const [showSavePreset, setShowSavePreset] = useState(false)

  // Physics inputs
  const [mass, setMass] = useState(80)
  const [eff, setEff] = useState(0.97)
  const [rho, setRho] = useState(1.225)

  // CdA/Crr state
  const [cda, setCda] = useState(0.32)
  const [crr, setCrr] = useState(0.004)

  // Nudge amounts for fine-tuning
  const [cdaNudge, setCdaNudge] = useState(0.001)
  const [crrNudge, setCrrNudge] = useState(0.0001)

  // Solver bounds - user configurable to prevent railing
  const [cdaMin, setCdaMin] = useState(0.15)
  const [cdaMax, setCdaMax] = useState(0.50)
  const [crrMin, setCrrMin] = useState(0.002)
  const [crrMax, setCrrMax] = useState(0.012)

  // Railing detection
  const [isRailing, setIsRailing] = useState(false)
  const [railingDetails, setRailingDetails] = useState(null)

  // Clamp CdA when bounds change
  useEffect(() => {
    if (cda < cdaMin) setCda(cdaMin)
    if (cda > cdaMax) setCda(cdaMax)
  }, [cda, cdaMin, cdaMax])

  // Clamp Crr when bounds change
  useEffect(() => {
    if (crr < crrMin) setCrr(crrMin)
    if (crr > crrMax) setCrr(crrMax)
  }, [crr, crrMin, crrMax])

  const [data, setData] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [hasPowerData, setHasPowerData] = useState(true)
  const [lapMarkers, setLapMarkers] = useState([])

  // Second file state (for climb mode)
  const [data2, setData2] = useState(null)
  const [, setStartTime2] = useState(null)
  const [fileName2, setFileName2] = useState(null)
  const [hasPowerData2, setHasPowerData2] = useState(true)
  const [, setLapMarkers2] = useState([])

  // Per-file ranges (for climb mode)
  const [range2, setRange2] = useState([0, 100])

  // Sample lag fixed at 0 to keep workflow simple
  const offset2 = 0

  // Climb mode result
  const [climbResult, setClimbResult] = useState(null)

  // Environment
  const [wSpd, setWSpd] = useState(0)
  const [wDir, setWDir] = useState(0)
  const offset = 0
  const [range, setRange] = useState([0, 100])

  // Solver
  const [method, setMethod] = useState('chung') // 'chung' or 'shen'
  const [busy, setBusy] = useState(false)
  const [fetchingW, setFetchingW] = useState(false)
  const [weatherError, setWeatherError] = useState(null)
  const [weatherApplyWind, setWeatherApplyWind] = useState(true)
  const [weatherApplyRho, setWeatherApplyRho] = useState(true)
  const [maxIterations, setMaxIterations] = useState(500)

  // Low-pass filter (for display only)
  const [filterGps, setFilterGps] = useState(false)
  const [filterVirtual, setFilterVirtual] = useState(false)
  const [filterIntensity, setFilterIntensity] = useState(5)

  // Y-axis autoscale (scale to visible range)
  const [autoScaleY, setAutoScaleY] = useState(true)

  // Reference lines (start/max elevation)
  const [showRefLines, setShowRefLines] = useState(false)
  // Lap marker lines/labels
  const [showLapLines, setShowLapLines] = useState(true)

  // Shen method state
  const [shenResult, setShenResult] = useState(null)

  // Sweep method state
  const [sweepResults, setSweepResults] = useState(null)
  const [sweepBusy, setSweepBusy] = useState(false)
  const [sweepProgress, setSweepProgress] = useState(0)
  const [sweepCdaMin, setSweepCdaMin] = useState(0.10)
  const [sweepCdaMax, setSweepCdaMax] = useState(0.60)
  const [sweepCrrMin, setSweepCrrMin] = useState(0.001)
  const [sweepCrrMax, setSweepCrrMax] = useState(0.020)
  const [sweepResolution, setSweepResolution] = useState(70)

  // Air density calculator state
  const [showRhoCalc, setShowRhoCalc] = useState(false)
  const [rhoTemp, setRhoTemp] = useState(20) // °C
  const [rhoElevation, setRhoElevation] = useState(0) // m
  const [rhoPressure, setRhoPressure] = useState(1013.25) // hPa
  const [rhoHumidity, setRhoHumidity] = useState(50) // %
  const [rhoUseElevation, setRhoUseElevation] = useState(true) // true = use elevation, false = use pressure
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })

  // Calculate air density from current state values
  const getCalculatedRho = () => {
    return calculateAirDensity({
      temperature: rhoTemp,
      humidity: rhoHumidity,
      elevation: rhoUseElevation ? rhoElevation : undefined,
      pressure: rhoUseElevation ? null : rhoPressure
    })
  }

  const applyCalculatedRho = () => {
    setRho(getCalculatedRho())
  }

  // File Handler for first file (supports GPX and FIT)
  const onFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    try {
      const result = await parseActivityFile(f)
      setData(result.data)
      setStartTime(result.startTime)
      setHasPowerData(result.hasPowerData)
      setLapMarkers(result.lapMarkers || [])
    } catch (err) {
      console.error('File parse error:', err)
      setErrorDialog({ open: true, message: err.message || 'Failed to parse file' })
    }
  }

  // File Handler for second file (climb mode) - supports GPX and FIT
  const onFile2 = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName2(f.name)
    try {
      const result = await parseActivityFile(f)
      setData2(result.data)
      setStartTime2(result.startTime)
      setHasPowerData2(result.hasPowerData)
      setLapMarkers2(result.lapMarkers || [])
    } catch (err) {
      console.error('File parse error:', err)
      setErrorDialog({ open: true, message: err.message || 'Failed to parse file' })
    }
  }

  // Reset analysis
  const resetAnalysis = () => {
    setData(null)
    setFileName(null)
    setStartTime(null)
    setHasPowerData(true)
    setLapMarkers([])
    setData2(null)
    setFileName2(null)
    setStartTime2(null)
    setHasPowerData2(true)
    setLapMarkers2([])
    setCda(0.32)
    setCrr(0.004)
    setWSpd(0)
    setWDir(0)
    setRange([0, 100])
    setRange2([0, 100])
    setMethod('chung')
    setMaxIterations(500)
    setFilterGps(false)
    setFilterVirtual(false)
    setFilterIntensity(5)
    setShenResult(null)
    setClimbResult(null)
    setSweepResults(null)
    setSweepCdaMin(0.10)
    setSweepCdaMax(0.60)
    setSweepCrrMin(0.001)
    setSweepCrrMax(0.020)
    setSweepResolution(70)
  }

  // Simulation calculation - compute virtual elevation for SELECTED RANGE ONLY
  // Starts fresh at ele[sIdx], treats cropped region as standalone segment
  const sim = useMemo(() => {
    if (!data) return null
    const { pwr, v, a, ds, ele, b } = data
    const sIdx = Math.floor((range[0] / 100) * pwr.length)
    const eIdx = Math.floor((range[1] / 100) * pwr.length)

    if (sIdx >= eIdx || eIdx - sIdx < 2) {
      return { vEle: [], err: [], sIdx, eIdx, rmse: 0, anomalies: [], emptyRange: true }
    }

    const iOff = Math.round(offset)
    const wRad = wDir * (Math.PI / 180)

    // Arrays for the selected range only (same length as full data for chart compatibility)
    // Values outside selected range are set to the boundary values for smooth display
    const vEle = new Array(pwr.length)
    const err = new Array(pwr.length)

    // Start fresh at GPS elevation of range start
    const rangeStartElev = method === 'shen' ? 0 : ele[sIdx]
    let cur = rangeStartElev

    // Compute virtual elevation for selected range
    for (let i = sIdx; i < eIdx; i++) {
      if (i > sIdx) {
        const vg = Math.max(1.0, v[i])
        let pi = i - iOff
        if (pi < 0) pi = 0
        if (pi >= pwr.length) pi = pwr.length - 1

        const pw = pwr[pi] * eff
        const rh = rho
        const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wRad)

        const fa = 0.5 * rh * cda * va * va * Math.sign(va)
        const ft = pw / vg
        const fr = mass * GRAVITY * crr
        const fac = mass * a[i]

        cur += ((ft - fr - fac - fa) / (mass * GRAVITY)) * ds[i]
      }
      vEle[i] = cur
      err[i] = method === 'shen' ? cur : cur - ele[i]
    }

    // Fill outside range with boundary values (no discontinuity, just flat extension)
    const startVEle = vEle[sIdx]
    const endVEle = vEle[eIdx - 1]
    const startErr = err[sIdx]
    const endErr = err[eIdx - 1]

    for (let i = 0; i < sIdx; i++) {
      vEle[i] = startVEle
      err[i] = startErr
    }
    for (let i = eIdx; i < pwr.length; i++) {
      vEle[i] = endVEle
      err[i] = endErr
    }

    // Calculate RMSE and R² for the selected range
    let sqSum = 0, cnt = 0, ssTot = 0
    let eleSum = 0
    for (let i = sIdx; i < eIdx; i++) {
      eleSum += ele[i]
    }
    const eleMean = eleSum / (eIdx - sIdx)

    for (let i = sIdx; i < eIdx; i++) {
      sqSum += err[i] * err[i]
      ssTot += (ele[i] - eleMean) ** 2
      cnt++
    }

    const rmse = cnt > 0 ? Math.sqrt(sqSum / cnt) : 0
    const r2 = ssTot > 0 ? 1 - (sqSum / ssTot) : 0

    // Calculate net elevation
    const netElev = vEle[eIdx - 1] - vEle[sIdx]

    return { vEle, err, sIdx, eIdx, rmse, r2, netElev }
  }, [data, cda, crr, mass, eff, rho, offset, wSpd, wDir, range, method])

  // Simulation calculation for second file (climb/shen mode) - full virtual elevation
  const sim2 = useMemo(() => {
    if (!data2 || (method !== 'climb' && method !== 'shen')) return null
    const { pwr, v, a, ds, ele, b } = data2
    const sIdx = Math.floor((range2[0] / 100) * pwr.length)
    const eIdx = Math.floor((range2[1] / 100) * pwr.length)

    if (sIdx >= eIdx || eIdx - sIdx < 2) {
      return { vEle: [], err: [], sIdx, eIdx, rmse: 0, emptyRange: true }
    }

    // Compute virtual elevation for FULL dataset
    const vEle = new Array(pwr.length).fill(0)
    const err = new Array(pwr.length).fill(0)

    // For Shen method: start at 0 (flat ground assumption)
    // For other methods: start at GPS elevation
    const startElev = method === 'shen' ? 0 : ele[0]
    vEle[0] = startElev
    let cur = startElev

    const iOff = Math.round(offset2)
    const wRad = wDir * (Math.PI / 180)

    for (let i = 0; i < pwr.length; i++) {
      const vg = Math.max(1.0, v[i])
      let pi = i - iOff
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1

      const pw = pwr[pi] * eff
      const rh = rho
      const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wRad)

      const fa = 0.5 * rh * cda * va * va * Math.sign(va)
      const ft = pw / vg
      const fr = mass * GRAVITY * crr
      const fac = mass * a[i]

      if (i > 0) {
        cur += ((ft - fr - fac - fa) / (mass * GRAVITY)) * ds[i]
      }
      vEle[i] = cur
      // For Shen: error is deviation from flat (0), for others: deviation from GPS
      err[i] = method === 'shen' ? cur : cur - ele[i]
    }

    // Calculate RMSE only within the selected range
    let sqSum = 0, cnt = 0
    for (let i = sIdx; i < eIdx; i++) {
      const errVal = method === 'shen' ? vEle[i] : err[i]
      sqSum += errVal * errVal
      cnt++
    }

    const rmse = cnt > 0 ? Math.sqrt(sqSum / cnt) : 0

    // Calculate net elevation for Shen method
    const netElev = vEle[eIdx - 1] - vEle[sIdx]

    return { vEle, err, sIdx, eIdx, rmse, netElev }
  }, [data2, cda, crr, mass, eff, rho, offset2, wSpd, wDir, range2, method])

  // Calculate current bow for display
  const currentBow = useMemo(() => {
    if (!sim || !sim.vEle || sim.vEle.length < 10) return null
    const vEleSlice = sim.vEle.slice(sim.sIdx, sim.eIdx)
    return calculateBow(vEleSlice)
  }, [sim])

  // Calculate current bow for second file (Shen/Climb mode)
  const currentBow2 = useMemo(() => {
    if (!sim2 || !sim2.vEle || sim2.vEle.length < 10) return null
    const vEleSlice = sim2.vEle.slice(sim2.sIdx, sim2.eIdx)
    return calculateBow(vEleSlice)
  }, [sim2])

  // Solvers
  const runGlobal = () => {
    if (!data) return
    setBusy(true)
    setShenResult(null)
    setTimeout(() => {
      const res = solveCdaCrr(data, sim.sIdx, sim.eIdx, cda, crr, mass, eff, rho, offset, wSpd, wDir, {
        method: 'chung',
        maxIterations,
        cdaBounds: [cdaMin, cdaMax],
        crrBounds: [crrMin, crrMax]
      })
      setCda(res.cda)
      setCrr(res.crr)
      setIsRailing(res.isRailing)
      setRailingDetails(res.railingDetails)
      setBusy(false)
    }, 50)
  }

  const runShen = () => {
    // Shen method requires two files (slow and fast acceleration)
    if (!data || !data2 || !sim || !sim2) return
    setBusy(true)
    setShenResult(null)
    setTimeout(() => {
      const res = solveCdaCrrShenDual(
        data, sim.sIdx, sim.eIdx,
        data2, sim2.sIdx, sim2.eIdx,
        cda, crr,
        mass, eff, rho,
        offset, offset2,
        wSpd, wDir,
        { maxIterations, cdaBounds: [cdaMin, cdaMax], crrBounds: [crrMin, crrMax] }
      )
      setCda(res.cda)
      setCrr(res.crr)
      setShenResult(res)
      setIsRailing(res.isRailing)
      setRailingDetails(res.railingDetails)
      setBusy(false)
    }, 50)
  }

  const runClimb = () => {
    if (!data || !data2 || !sim || !sim2) return
    setBusy(true)
    setClimbResult(null)
    setTimeout(() => {
      const res = solveCdaCrrClimb(
        data, sim.sIdx, sim.eIdx,
        data2, sim2.sIdx, sim2.eIdx,
        cda, crr,
        mass, eff, rho,
        offset, offset2,
        wSpd, wDir,
        { maxIterations, cdaBounds: [cdaMin, cdaMax], crrBounds: [crrMin, crrMax] }
      )
      setCda(res.cda)
      setCrr(res.crr)
      setClimbResult(res)
      setIsRailing(res.isRailing)
      setRailingDetails(res.railingDetails)
      setBusy(false)
    }, 50)
  }

  const runSweep = async () => {
    if (!data || !sim) return
    setSweepBusy(true)
    setSweepResults(null)
    setSweepProgress(0)

    const res = await solveCdaCrrSweep(
      data, sim.sIdx, sim.eIdx,
      mass, eff, rho, offset, wSpd, wDir,
      {
        cdaMin: sweepCdaMin,
        cdaMax: sweepCdaMax,
        cdaSteps: sweepResolution,
        crrMin: sweepCrrMin,
        crrMax: sweepCrrMax,
        crrSteps: sweepResolution,
        onProgress: (percent) => setSweepProgress(percent)
      }
    )

    setSweepResults(res)
    // Set CdA/Crr to the best solution
    if (res.best) {
      setCda(res.best.cda)
      setCrr(res.best.crr)
    }
    setSweepBusy(false)
    setSweepProgress(100)
  }

  // Handle clicking on the heatmap to select a CdA/Crr point
  const handleSweepClick = (event) => {
    if (!sweepResults || !event.points || !event.points[0]) return
    const point = event.points[0]
    // x = CdA, y = Crr
    setCda(point.x)
    setCrr(point.y)
  }

  const getWeather = async () => {
    if (!data || !startTime) return
    if (!weatherApplyWind && !weatherApplyRho) {
      setWeatherError('Enable Wind and/or Air Density update to use fetched weather')
      return
    }
    setFetchingW(true)
    setWeatherError(null)
    try {
      const mid = Math.floor(data.lat.length / 2)
      const ds = startTime.toISOString().split('T')[0]
      const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${data.lat[mid]}&longitude=${data.lon[mid]}&start_date=${ds}&end_date=${ds}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,surface_pressure,pressure_msl`
      const r = await fetch(u)
      if (!r.ok) throw new Error('Weather service unavailable')
      const j = await r.json()
      if (j.hourly) {
        const h = startTime.getUTCHours()
        const wind10m = j.hourly.wind_speed_10m?.[h]
        const windDir = j.hourly.wind_direction_10m?.[h]
        const tempC = j.hourly.temperature_2m?.[h]
        const humidity = j.hourly.relative_humidity_2m?.[h]
        const pressureHpa = j.hourly.surface_pressure?.[h] ?? j.hourly.pressure_msl?.[h]

        const hasWind = Number.isFinite(wind10m)
        const hasTemp = Number.isFinite(tempC)
        const hasHumidity = Number.isFinite(humidity)
        const hasPressure = Number.isFinite(pressureHpa)
        let appliedAny = false

        if (weatherApplyWind && hasWind) {
          // Convert 10 m wind (km/h) to rider-height m/s using the wind profile power law factor.
          setWSpd(parseFloat((wind10m / 3.6 * 0.6).toFixed(2)))
          if (Number.isFinite(windDir)) setWDir(windDir)
          appliedAny = true
        }

        if (weatherApplyRho && hasTemp) setRhoTemp(parseFloat(tempC.toFixed(1)))
        if (weatherApplyRho && hasHumidity) setRhoHumidity(Math.round(humidity))

        if (weatherApplyRho && hasTemp && hasHumidity) {
          if (hasPressure) {
            setRhoUseElevation(false)
            setRhoPressure(parseFloat(pressureHpa.toFixed(1)))
            setRho(calculateAirDensity({
              temperature: tempC,
              humidity,
              pressure: pressureHpa
            }))
            appliedAny = true
          } else {
            const elev = Number.isFinite(data.ele?.[mid]) ? data.ele[mid] : rhoElevation
            setRhoUseElevation(true)
            if (Number.isFinite(data.ele?.[mid])) setRhoElevation(Math.round(elev))
            setRho(calculateAirDensity({
              temperature: tempC,
              humidity,
              elevation: elev
            }))
            appliedAny = true
          }
        }

        if (!appliedAny) {
          setWeatherError('No data for this time')
        }
      } else {
        setWeatherError('No weather data available')
      }
    } catch (e) {
      console.error(e)
      setWeatherError('Failed to fetch weather')
    }
    setFetchingW(false)
  }

  // Calculate distance ranges from percentage ranges
  // IMPORTANT: Use actual distances at the index boundaries to match vEle computation
  const distanceRange = useMemo(() => {
    if (!data) return [0, 0]
    const sIdx = Math.floor((range[0] / 100) * data.dist.length)
    const eIdx = Math.min(Math.floor((range[1] / 100) * data.dist.length), data.dist.length - 1)
    return [data.dist[sIdx] || 0, data.dist[eIdx] || 0]
  }, [data, range])

  const distanceRange2 = useMemo(() => {
    if (!data2) return [0, 0]
    const sIdx = Math.floor((range2[0] / 100) * data2.dist.length)
    const eIdx = Math.min(Math.floor((range2[1] / 100) * data2.dist.length), data2.dist.length - 1)
    return [data2.dist[sIdx] || 0, data2.dist[eIdx] || 0]
  }, [data2, range2])

  const findDistanceIndex = useCallback((targetDist) => {
    if (!data || !data.dist || data.dist.length === 0) return 0
    const dist = data.dist
    const minDist = dist[0] || 0
    const maxDist = dist[dist.length - 1] || 0
    const clampedDist = Math.max(minDist, Math.min(maxDist, targetDist))

    let lo = 0
    let hi = dist.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (dist[mid] < clampedDist) lo = mid + 1
      else hi = mid
    }
    return lo
  }, [data])

  const distanceToRangePct = useCallback((targetDist, inclusiveEnd = false) => {
    if (!data || !data.dist || data.dist.length === 0) return 0
    const idx = findDistanceIndex(targetDist)
    const length = data.dist.length
    const adjustedIdx = inclusiveEnd ? Math.min(length, idx + 1) : idx
    return (adjustedIdx / length) * 100
  }, [data, findDistanceIndex])

  const normalizeRangePct = useCallback((startPct, endPct) => {
    if (!data || !data.dist || data.dist.length < 2) return [0, 100]
    const minStep = 100 / data.dist.length

    let s = Number.isFinite(startPct) ? startPct : 0
    let e = Number.isFinite(endPct) ? endPct : 100

    if (s > e) [s, e] = [e, s]
    s = Math.max(0, Math.min(100, s))
    e = Math.max(0, Math.min(100, e))

    if (e - s < minStep) {
      if (s <= 100 - minStep) {
        e = s + minStep
      } else {
        s = 100 - minStep
        e = 100
      }
    }

    return [s, e]
  }, [data])

  const applyDistanceCrop = useCallback((startDist, endDist) => {
    if (!data) return
    const startPct = distanceToRangePct(startDist, false)
    const endPct = distanceToRangePct(endDist, true)
    const [nextStart, nextEnd] = normalizeRangePct(startPct, endPct)

    setRange((prev) => {
      if (Math.abs(prev[0] - nextStart) < 1e-6 && Math.abs(prev[1] - nextEnd) < 1e-6) {
        return prev
      }
      return [nextStart, nextEnd]
    })
  }, [data, distanceToRangePct, normalizeRangePct])

  const findDistanceIndex2 = useCallback((targetDist) => {
    if (!data2 || !data2.dist || data2.dist.length === 0) return 0
    const dist = data2.dist
    const minDist = dist[0] || 0
    const maxDist = dist[dist.length - 1] || 0
    const clampedDist = Math.max(minDist, Math.min(maxDist, targetDist))

    let lo = 0
    let hi = dist.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (dist[mid] < clampedDist) lo = mid + 1
      else hi = mid
    }
    return lo
  }, [data2])

  const distanceToRangePct2 = useCallback((targetDist, inclusiveEnd = false) => {
    if (!data2 || !data2.dist || data2.dist.length === 0) return 0
    const idx = findDistanceIndex2(targetDist)
    const length = data2.dist.length
    const adjustedIdx = inclusiveEnd ? Math.min(length, idx + 1) : idx
    return (adjustedIdx / length) * 100
  }, [data2, findDistanceIndex2])

  const normalizeRangePct2 = useCallback((startPct, endPct) => {
    if (!data2 || !data2.dist || data2.dist.length < 2) return [0, 100]
    const minStep = 100 / data2.dist.length

    let s = Number.isFinite(startPct) ? startPct : 0
    let e = Number.isFinite(endPct) ? endPct : 100

    if (s > e) [s, e] = [e, s]
    s = Math.max(0, Math.min(100, s))
    e = Math.max(0, Math.min(100, e))

    if (e - s < minStep) {
      if (s <= 100 - minStep) {
        e = s + minStep
      } else {
        s = 100 - minStep
        e = 100
      }
    }

    return [s, e]
  }, [data2])

  const applyDistanceCrop2 = useCallback((startDist, endDist) => {
    if (!data2) return
    const startPct = distanceToRangePct2(startDist, false)
    const endPct = distanceToRangePct2(endDist, true)
    const [nextStart, nextEnd] = normalizeRangePct2(startPct, endPct)

    setRange2((prev) => {
      if (Math.abs(prev[0] - nextStart) < 1e-6 && Math.abs(prev[1] - nextEnd) < 1e-6) {
        return prev
      }
      return [nextStart, nextEnd]
    })
  }, [data2, distanceToRangePct2, normalizeRangePct2])

  // Handle rangeslider changes for file 1
  const handleRelayout = useCallback((eventData) => {
    if (!eventData || (!data && !data2)) return

    const parseFinite = (value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : null
    }

    const axes = ['xaxis', 'xaxis2', 'xaxis3']
    let newStart
    let newEnd

    for (const axis of axes) {
      const startValue = parseFinite(eventData[`${axis}.range[0]`])
      const endValue = parseFinite(eventData[`${axis}.range[1]`])
      if (startValue !== null && endValue !== null) {
        newStart = startValue
        newEnd = endValue
        break
      }

      const rangeValues = eventData[`${axis}.range`]
      if (Array.isArray(rangeValues) && rangeValues.length >= 2) {
        const rangeStart = parseFinite(rangeValues[0])
        const rangeEnd = parseFinite(rangeValues[1])
        if (rangeStart !== null && rangeEnd !== null) {
          newStart = rangeStart
          newEnd = rangeEnd
          break
        }
      }
    }

    if (newStart !== undefined && newEnd !== undefined) {
      if (data) applyDistanceCrop(newStart, newEnd)
      if (data2 && (method === 'shen' || method === 'climb')) applyDistanceCrop2(newStart, newEnd)
      return
    }

    // Only treat autorange as reset when no explicit x-range keys are present.
    const hasXAutorange = Object.keys(eventData).some((key) => (
      /^xaxis\d*\.autorange$/.test(key) && eventData[key] === true
    ))
    if (hasXAutorange) {
      if (data) setRange([0, 100])
      if (data2 && (method === 'shen' || method === 'climb')) setRange2([0, 100])
    }
  }, [data, data2, method, applyDistanceCrop, applyDistanceCrop2])

  // Calculate Y-axis range for visible data (when autoScaleY is enabled)
  const visibleYRange = useMemo(() => {
    if (!autoScaleY || !data || !sim) return null

    // Find indices within the visible distance range
    const startDist = distanceRange[0]
    const endDist = distanceRange[1]

    let minEle = Infinity
    let maxEle = -Infinity
    let minErr = Infinity
    let maxErr = -Infinity
    let minPwr = Infinity
    let maxPwr = -Infinity
    let hasEle = false
    let hasErr = false
    let hasPwr = false

    const displayEle = filterGps ? lowPassFilter(data.ele, filterIntensity) : data.ele
    const displayVEle = filterVirtual ? lowPassFilter(sim.vEle, filterIntensity) : sim.vEle

    for (let i = 0; i < data.dist.length; i++) {
      if (data.dist[i] >= startDist && data.dist[i] <= endDist) {
        // Elevation (both GPS and virtual)
        if (Number.isFinite(displayEle[i])) {
          hasEle = true
          minEle = Math.min(minEle, displayEle[i])
          maxEle = Math.max(maxEle, displayEle[i])
        }
        if (Number.isFinite(displayVEle[i])) {
          hasEle = true
          minEle = Math.min(minEle, displayVEle[i])
          maxEle = Math.max(maxEle, displayVEle[i])
        }
        // Error
        if (Number.isFinite(sim.err[i])) {
          hasErr = true
          minErr = Math.min(minErr, sim.err[i])
          maxErr = Math.max(maxErr, sim.err[i])
        }
        // Power
        if (Number.isFinite(data.pwr[i])) {
          hasPwr = true
          minPwr = Math.min(minPwr, data.pwr[i])
          maxPwr = Math.max(maxPwr, data.pwr[i])
        }
      }
    }

    const ranges = {}
    if (hasEle) {
      const elePadding = (maxEle - minEle) * 0.05 || 1
      ranges.elevation = [minEle - elePadding, maxEle + elePadding]
    }
    if (hasErr) {
      const errPadding = (maxErr - minErr) * 0.05 || 0.5
      ranges.error = [minErr - errPadding, maxErr + errPadding]
    }
    if (hasPwr) {
      const pwrPadding = (maxPwr - minPwr) * 0.05 || 10
      ranges.power = [minPwr - pwrPadding, maxPwr + pwrPadding]
    }

    return Object.keys(ranges).length > 0 ? ranges : null
  }, [autoScaleY, data, sim, distanceRange, filterGps, filterVirtual, filterIntensity])

  // Chart layout with rangeslider and lap markers
  const layout = useMemo(() => {
    // Create vertical line shapes for lap markers
    const lapShapes = showLapLines ? lapMarkers.map(lap => ({
      type: 'line',
      x0: lap.distance,
      x1: lap.distance,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: 'rgba(251, 191, 36, 0.6)', width: 2, dash: 'dot' }
    })) : []

    // Create annotations for lap labels
    const lapAnnotations = showLapLines ? lapMarkers.map(lap => ({
      x: lap.distance,
      y: 1,
      yref: 'paper',
      text: lap.name,
      showarrow: false,
      font: { size: 10, color: 'rgba(251, 191, 36, 0.9)' },
      textangle: -90,
      xanchor: 'left',
      yanchor: 'top',
      xshift: 3
    })) : []

    // Reference lines for start and max elevation
    const refShapes = []
    const refAnnotations = []
    if (showRefLines && sim && !sim.emptyRange && data) {
      // Get start elevation (at range start)
      const startElev = data.ele[sim.sIdx]

      // Get max virtual elevation within range
      let maxVElev = -Infinity
      for (let i = sim.sIdx; i < sim.eIdx; i++) {
        if (sim.vEle[i] > maxVElev) maxVElev = sim.vEle[i]
      }

      // Start elevation line (green dashed)
      refShapes.push({
        type: 'line',
        x0: distanceRange[0],
        x1: distanceRange[1],
        y0: startElev,
        y1: startElev,
        yref: 'y',
        line: { color: 'rgba(34, 197, 94, 0.7)', width: 1.5, dash: 'dash' }
      })
      refAnnotations.push({
        x: distanceRange[0],
        y: startElev,
        yref: 'y',
        text: `Start: ${startElev.toFixed(1)}m`,
        showarrow: false,
        font: { size: 9, color: 'rgba(34, 197, 94, 0.9)' },
        xanchor: 'left',
        yanchor: 'bottom',
        bgcolor: 'rgba(15, 23, 42, 0.8)',
        borderpad: 2
      })

      // Max virtual elevation line (cyan dashed)
      if (maxVElev > -Infinity) {
        refShapes.push({
          type: 'line',
          x0: distanceRange[0],
          x1: distanceRange[1],
          y0: maxVElev,
          y1: maxVElev,
          yref: 'y',
          line: { color: 'rgba(6, 182, 212, 0.7)', width: 1.5, dash: 'dash' }
        })
        refAnnotations.push({
          x: distanceRange[1],
          y: maxVElev,
          yref: 'y',
          text: `Max: ${maxVElev.toFixed(1)}m`,
          showarrow: false,
          font: { size: 9, color: 'rgba(6, 182, 212, 0.9)' },
          xanchor: 'right',
          yanchor: 'bottom',
          bgcolor: 'rgba(15, 23, 42, 0.8)',
          borderpad: 2
        })
      }
    }

    const dualMode = method === 'shen' || method === 'climb'
    const xRange = dualMode
      ? [
          Math.min(
            data ? distanceRange[0] : Infinity,
            data2 ? distanceRange2[0] : Infinity
          ),
          Math.max(
            data ? distanceRange[1] : -Infinity,
            data2 ? distanceRange2[1] : -Infinity
          )
        ]
      : distanceRange

    const resolvedXRange = Number.isFinite(xRange[0]) && Number.isFinite(xRange[1]) && xRange[1] > xRange[0]
      ? xRange
      : distanceRange

    return {
      autosize: true,
      paper_bgcolor: '#0f172a',
      plot_bgcolor: '#0f172a',
      font: { color: '#94a3b8', size: 11 },
      margin: { t: 50, l: 50, r: 20, b: 40 },
      grid: { rows: 3, columns: 1, pattern: 'independent' },
      showlegend: true,
      legend: { orientation: 'h', y: 1.02, x: 0, font: { size: 10 } },
      hovermode: 'x',
      xaxis: {
        title: 'Distance (m)',
        gridcolor: '#1e293b',
        anchor: 'y3',
        range: resolvedXRange,
        showspikes: true,
        spikemode: 'across',
        spikethickness: 1,
        spikecolor: '#6366f1',
        spikedash: 'solid',
        rangeslider: {
          visible: true,
          thickness: 0.08,
          bgcolor: '#1e293b',
          bordercolor: '#334155',
          borderwidth: 1
        }
      },
      yaxis: {
        title: 'Elevation (m)',
        gridcolor: '#1e293b',
        domain: [0.55, 1],
        ...(visibleYRange?.elevation && { range: visibleYRange.elevation })
      },
      yaxis2: {
        title: 'Error (m)',
        gridcolor: '#1e293b',
        anchor: 'x',
        domain: [0.30, 0.50],
        ...(visibleYRange?.error && { range: visibleYRange.error })
      },
      yaxis3: {
        title: 'Power (W)',
        gridcolor: '#1e293b',
        anchor: 'x',
        domain: [0.08, 0.26],
        ...(visibleYRange?.power && { range: visibleYRange.power })
      },
      shapes: [...lapShapes, ...refShapes],
      annotations: [...lapAnnotations, ...refAnnotations]
    }
  }, [distanceRange, distanceRange2, visibleYRange, lapMarkers, showLapLines, showRefLines, sim, data, data2, method])

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-brand-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Quick Test</h2>
          <p className="text-gray-400 mb-6">
            Analyze a GPX/FIT file to calculate your CdA and Crr values. Create an account to get started.
          </p>
          <p className="text-sm text-gray-500">
            Sign in from the Dashboard to use this feature.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar Controls */}
      <div className="w-72 flex-shrink-0 border-r border-dark-border overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-white">Quick Test</h2>
          <p className="text-xs text-gray-500">Analyze a single ride without creating a study</p>
        </div>

        {/* File Upload */}
        <div className="card">
          {method === 'chung' || method === 'sweep' ? (
            <>
              <label className={`block w-full cursor-pointer ${method === 'sweep' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-brand-primary hover:bg-indigo-600'} text-white text-center py-2.5 rounded font-medium transition-colors`}>
                Upload GPX/FIT File
                <input type="file" accept=".gpx,.fit" onChange={onFile} className="hidden" />
              </label>
              {!data && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  {method === 'sweep' ? (
                    <>Upload a file to visualize <span className="text-violet-400">all possible solutions</span></>
                  ) : (
                    <>Upload a file for <span className="text-indigo-400">Chung</span> analysis</>
                  )}
                </p>
              )}
              {data && fileName && (
                <div className="mt-2">
                  <p className="text-center text-xs text-gray-400 truncate">{fileName}</p>
                  {!hasPowerData && (
                    <p className="text-center text-xs text-yellow-500 mt-1">
                      Warning: No power data detected
                    </p>
                  )}
                  <button onClick={resetAnalysis} className="w-full mt-2 text-xs text-gray-400 hover:text-white border border-dark-border rounded py-1 hover:bg-dark-input transition-colors">
                    Clear & Reset
                  </button>
                </div>
              )}
            </>
          ) : method === 'shen' ? (
            <>
              {/* Shen Mode: Two file uploads (slow/fast acceleration) */}
              <div className="space-y-3">
                {/* Slow Acceleration File */}
                <div>
                  <label className="block w-full cursor-pointer bg-amber-600 hover:bg-amber-500 text-white text-center py-2 rounded font-medium text-sm transition-colors">
                    {fileName ? 'Change Slow Accel File' : 'Upload Slow Accel File'}
                    <input type="file" accept=".gpx,.fit" onChange={onFile} className="hidden" />
                  </label>
                  {fileName && (
                    <p className="text-center text-xxs text-amber-400 mt-1 truncate">{fileName}</p>
                  )}
                  {fileName && !hasPowerData && (
                    <p className="text-center text-xxs text-yellow-500 mt-1">No power data</p>
                  )}
                </div>

                {/* Fast Acceleration File */}
                <div>
                  <label className="block w-full cursor-pointer bg-orange-600 hover:bg-orange-500 text-white text-center py-2 rounded font-medium text-sm transition-colors">
                    {fileName2 ? 'Change Fast Accel File' : 'Upload Fast Accel File'}
                    <input type="file" accept=".gpx,.fit" onChange={onFile2} className="hidden" />
                  </label>
                  {fileName2 && (
                    <p className="text-center text-xxs text-orange-400 mt-1 truncate">{fileName2}</p>
                  )}
                  {fileName2 && !hasPowerData2 && (
                    <p className="text-center text-xxs text-yellow-500 mt-1">No power data</p>
                  )}
                </div>
              </div>

              {!data && !data2 && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Upload two acceleration runs (slow & fast)
                </p>
              )}

              {(data || data2) && (
                <button onClick={resetAnalysis} className="w-full mt-3 text-xs text-gray-400 hover:text-white border border-dark-border rounded py-1 hover:bg-dark-input transition-colors">
                  Clear & Reset
                </button>
              )}
            </>
          ) : (
            <>
              {/* Climb Mode: Two file uploads */}
              <div className="space-y-3">
                {/* Low Speed File */}
                <div>
                  <label className="block w-full cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white text-center py-2 rounded font-medium text-sm transition-colors">
                    {fileName ? 'Change Low Speed File' : 'Upload Low Speed File'}
                    <input type="file" accept=".gpx,.fit" onChange={onFile} className="hidden" />
                  </label>
                  {fileName && (
                    <p className="text-center text-xxs text-cyan-400 mt-1 truncate">{fileName}</p>
                  )}
                  {fileName && !hasPowerData && (
                    <p className="text-center text-xxs text-yellow-500 mt-1">No power data</p>
                  )}
                </div>

                {/* High Speed File */}
                <div>
                  <label className="block w-full cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white text-center py-2 rounded font-medium text-sm transition-colors">
                    {fileName2 ? 'Change High Speed File' : 'Upload High Speed File'}
                    <input type="file" accept=".gpx,.fit" onChange={onFile2} className="hidden" />
                  </label>
                  {fileName2 && (
                    <p className="text-center text-xxs text-yellow-400 mt-1 truncate">{fileName2}</p>
                  )}
                  {fileName2 && !hasPowerData2 && (
                    <p className="text-center text-xxs text-yellow-500 mt-1">No power data</p>
                  )}
                </div>
              </div>

              {!data && !data2 && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Upload two files from the same climb
                </p>
              )}

              {(data || data2) && (
                <button onClick={resetAnalysis} className="w-full mt-3 text-xs text-gray-400 hover:text-white border border-dark-border rounded py-1 hover:bg-dark-input transition-colors">
                  Clear & Reset
                </button>
              )}
            </>
          )}
        </div>

        {/* Combined: Analysis Method + System Parameters + Solver */}
        <div className="card">
          <h3 className="label-sm mb-2">Analysis</h3>

          {/* Method Selector - Shows methods based on feature flags */}
          {hasAnyExtraMethod ? (
            <div className={`flex bg-dark-input p-0.5 rounded border border-dark-border mb-3 ${(data || data2) ? 'opacity-50' : ''}`}>
              <button
                onClick={() => { if (!data && !data2) setMethod('chung') }}
                disabled={!!(data || data2)}
                className={`px-2 py-1.5 rounded text-xxs font-medium flex-1 transition-colors ${method === 'chung' ? 'bg-indigo-600 text-white' : 'text-gray-400'} ${(data || data2) ? 'cursor-not-allowed' : ''}`}
              >
                Chung
              </button>
              {hasShenMethod && (
                <button
                  onClick={() => { if (!data && !data2) setMethod('shen') }}
                  disabled={!!(data || data2)}
                  className={`px-2 py-1.5 rounded text-xxs font-medium flex-1 transition-colors ${method === 'shen' ? 'bg-amber-600 text-white' : 'text-gray-400'} ${(data || data2) ? 'cursor-not-allowed' : ''}`}
                >
                  Shen
                </button>
              )}
              {hasClimbMethod && (
                <button
                  onClick={() => { if (!data && !data2) setMethod('climb') }}
                  disabled={!!(data || data2)}
                  className={`px-2 py-1.5 rounded text-xxs font-medium flex-1 transition-colors ${method === 'climb' ? 'bg-emerald-600 text-white' : 'text-gray-400'} ${(data || data2) ? 'cursor-not-allowed' : ''}`}
                >
                  Climb
                </button>
              )}
              {hasSweepMethod && (
                <button
                  onClick={() => { if (!data && !data2) setMethod('sweep') }}
                  disabled={!!(data || data2)}
                  className={`px-2 py-1.5 rounded text-xxs font-medium flex-1 transition-colors ${method === 'sweep' ? 'bg-violet-600 text-white' : 'text-gray-400'} ${(data || data2) ? 'cursor-not-allowed' : ''}`}
                >
                  Sweep
                </button>
              )}
            </div>
          ) : (
            /* Only Chung method available */
            <div className="bg-dark-input p-2 rounded border border-dark-border mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xxs px-2 py-1 rounded bg-indigo-600 text-white font-medium">Chung Method</span>
                <span className="text-xxs text-gray-500">Virtual Elevation Analysis</span>
              </div>
            </div>
          )}

          {/* System Parameters */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xxs text-gray-500 mb-1 block">Mass (kg)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="200"
                value={mass}
                onChange={e => {
                  const val = safeNum(e.target.value, mass)
                  setMass(Math.max(30, Math.min(200, val)))
                }}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="text-xxs text-gray-500 mb-1 block">Efficiency</label>
              <input
                type="number"
                step="0.01"
                min="0.9"
                max="1"
                value={eff}
                onChange={e => {
                  const val = safeNum(e.target.value, eff)
                  setEff(Math.max(0.9, Math.min(1, val)))
                }}
                className="input-dark w-full"
              />
            </div>
          </div>

          {/* Air Density */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xxs text-gray-500">Air Density (kg/m³)</label>
              <button
                onClick={() => setShowRhoCalc(!showRhoCalc)}
                className="text-xxs text-indigo-400 hover:text-indigo-300"
              >
                {showRhoCalc ? 'Hide Calculator' : 'Calculator'}
              </button>
            </div>
            <input
              type="number"
              step="0.001"
              value={rho}
              onChange={e => setRho(safeNum(e.target.value, rho))}
              className="input-dark w-full"
            />
          </div>

          {/* Air Density Calculator (collapsible) */}
          {showRhoCalc && (
            <div className="mb-3 p-3 bg-dark-bg rounded border border-dark-border space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">Temperature (°C)</label>
                  <input type="number" step="0.1" value={rhoTemp} onChange={e => setRhoTemp(safeNum(e.target.value, rhoTemp))} className="input-dark w-full" />
                </div>
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">Humidity (%)</label>
                  <input type="number" step="1" min="0" max="100" value={rhoHumidity} onChange={e => setRhoHumidity(safeNum(e.target.value, rhoHumidity))} className="input-dark w-full" />
                </div>
              </div>
              <div className="flex bg-dark-input p-0.5 rounded border border-dark-border">
                <button onClick={() => setRhoUseElevation(true)} className={`px-2 py-1.5 rounded text-xs font-medium flex-1 ${rhoUseElevation ? 'bg-slate-600 text-white' : 'text-gray-400'}`}>Elevation</button>
                <button onClick={() => setRhoUseElevation(false)} className={`px-2 py-1.5 rounded text-xs font-medium flex-1 ${!rhoUseElevation ? 'bg-slate-600 text-white' : 'text-gray-400'}`}>Pressure</button>
              </div>
              {rhoUseElevation ? (
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">Elevation (m)</label>
                  <input type="number" step="1" value={rhoElevation} onChange={e => setRhoElevation(safeNum(e.target.value, rhoElevation))} className="input-dark w-full" />
                </div>
              ) : (
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">Pressure (hPa)</label>
                  <input type="number" step="0.1" value={rhoPressure} onChange={e => setRhoPressure(safeNum(e.target.value, rhoPressure))} className="input-dark w-full" />
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-dark-border">
                <span className="text-sm text-cyan-400 font-mono font-bold">{getCalculatedRho()} kg/m³</span>
                <button onClick={applyCalculatedRho} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded text-xs font-medium">Apply</button>
              </div>
            </div>
          )}

          {/* Weather Auto-Fill */}
          <div className="mb-3 p-2 bg-dark-bg rounded border border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xxs text-gray-400">Weather Auto-Fill</span>
              <button
                onClick={getWeather}
                disabled={fetchingW || (!weatherApplyWind && !weatherApplyRho)}
                className="btn-secondary text-xxs py-1 px-3"
              >
                {fetchingW ? 'Fetching...' : 'Fetch Weather'}
              </button>
            </div>
            <p className="text-xxs text-gray-500 mb-2">
              Apply fetched weather to wind and/or air density.
            </p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setWeatherApplyWind(!weatherApplyWind)}
                className={`text-xxs px-2 py-0.5 rounded border ${weatherApplyWind ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'border-dark-border text-gray-500'}`}
              >
                Update Wind
              </button>
              <button
                onClick={() => setWeatherApplyRho(!weatherApplyRho)}
                className={`text-xxs px-2 py-0.5 rounded border ${weatherApplyRho ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400' : 'border-dark-border text-gray-500'}`}
              >
                Update Air Density
              </button>
            </div>
            {weatherError && (
              <p className="text-xxs text-red-400 mb-2">{weatherError}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xxs text-gray-500 mb-1 block">Speed (m/s)</label>
                <input type="number" step="0.1" value={wSpd} onChange={e => setWSpd(safeNum(e.target.value, wSpd))} className="input-dark w-full" />
              </div>
              <div>
                <label className="text-xxs text-gray-500 mb-1 block">Direction (°)</label>
                <input type="number" step="1" value={wDir} onChange={e => setWDir(safeNum(e.target.value, wDir))} className="input-dark w-full" />
              </div>
            </div>
          </div>

          {/* Solver Controls */}
          {(data || (method !== 'chung' && (data || data2))) && (
            <div className="pt-3 border-t border-dark-border">
              {method === 'chung' && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <label className="text-xxs text-gray-500 mb-1 block">Max Iterations</label>
                    <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark w-full" />
                  </div>
                  <button onClick={runGlobal} disabled={busy} className="btn-primary mt-4 px-6">
                    {busy ? '...' : 'Auto-Fit'}
                  </button>
                </div>
              )}
              {method !== 'chung' && (
                <div className="mb-2">
                  <label className="text-xxs text-gray-500 mb-1 block">Max Iterations</label>
                  <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark w-full" />
                </div>
              )}

              {/* Shen/Climb file status and run button */}
              {method === 'shen' && (
                <>
                  <div className={`p-2 rounded text-xxs border mb-2 ${data && data2 ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'}`}>
                    <div className="flex items-center gap-2">
                      <span className={data ? 'text-amber-400' : 'text-gray-500'}>{data ? '✓' : '○'}</span>
                      <span className={data2 ? 'text-orange-400' : 'text-gray-500'}>{data2 ? '✓' : '○'}</span>
                      <span>{data && data2 ? 'Both loaded' : 'Load both files'}</span>
                    </div>
                  </div>
                  <button onClick={runShen} disabled={busy || !data || !data2} className={`w-full py-2 rounded font-medium text-xs ${data && data2 ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                    {busy ? 'Analyzing...' : 'Run Shen Method'}
                  </button>
                </>
              )}

              {method === 'climb' && (
                <>
                  <div className={`p-2 rounded text-xxs border mb-2 ${data && data2 ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'}`}>
                    <div className="flex items-center gap-2">
                      <span className={data ? 'text-cyan-400' : 'text-gray-500'}>{data ? '✓' : '○'}</span>
                      <span className={data2 ? 'text-yellow-400' : 'text-gray-500'}>{data2 ? '✓' : '○'}</span>
                      <span>{data && data2 ? 'Both loaded' : 'Load both files'}</span>
                    </div>
                  </div>
                  <button onClick={runClimb} disabled={busy || !data || !data2} className={`w-full py-2 rounded font-medium text-xs ${data && data2 ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                    {busy ? 'Analyzing...' : 'Run Climb Analysis'}
                  </button>
                </>
              )}

              {method === 'sweep' && (
                <>
                  <div className="space-y-2 mb-3">
                    {/* CdA Range */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xxs text-gray-500 mb-1 block">CdA Min</label>
                        <input type="number" step="0.01" min="0.05" max="0.50" value={sweepCdaMin} onChange={e => setSweepCdaMin(safeNum(e.target.value, sweepCdaMin))} className="input-dark w-full" />
                      </div>
                      <div>
                        <label className="text-xxs text-gray-500 mb-1 block">CdA Max</label>
                        <input type="number" step="0.01" min="0.15" max="0.80" value={sweepCdaMax} onChange={e => setSweepCdaMax(safeNum(e.target.value, sweepCdaMax))} className="input-dark w-full" />
                      </div>
                    </div>
                    {/* Crr Range */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xxs text-gray-500 mb-1 block">Crr Min</label>
                        <input type="number" step="0.001" min="0.001" max="0.010" value={sweepCrrMin} onChange={e => setSweepCrrMin(safeNum(e.target.value, sweepCrrMin))} className="input-dark w-full" />
                      </div>
                      <div>
                        <label className="text-xxs text-gray-500 mb-1 block">Crr Max</label>
                        <input type="number" step="0.001" min="0.005" max="0.030" value={sweepCrrMax} onChange={e => setSweepCrrMax(safeNum(e.target.value, sweepCrrMax))} className="input-dark w-full" />
                      </div>
                    </div>
                    {/* Resolution */}
                    <div>
                      <div className="flex justify-between text-xxs mb-1">
                        <span className="text-gray-500">Resolution</span>
                        <span className="text-violet-400">{sweepResolution}x{sweepResolution} = {(sweepResolution+1)*(sweepResolution+1).toLocaleString()} pts</span>
                      </div>
                      <input type="range" min="30" max="150" value={sweepResolution} onChange={e => setSweepResolution(parseInt(e.target.value))} className="w-full accent-violet-500" />
                    </div>
                    {/* Range validation warning */}
                    {(sweepCdaMin >= sweepCdaMax || sweepCrrMin >= sweepCrrMax) && (
                      <p className="text-xxs text-red-400 mt-1">
                        {sweepCdaMin >= sweepCdaMax && 'CdA min must be less than max. '}
                        {sweepCrrMin >= sweepCrrMax && 'Crr min must be less than max.'}
                      </p>
                    )}
                  </div>
                  {sweepBusy ? (
                    <div className="space-y-2">
                      {/* Progress bar container */}
                      <div className="relative h-8 bg-dark-bg rounded-lg overflow-hidden border border-violet-500/30">
                        {/* Animated gradient background */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600 transition-all duration-150 ease-out"
                          style={{ width: `${sweepProgress}%` }}
                        />
                        {/* Shimmer effect */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
                          style={{ width: `${sweepProgress}%` }}
                        />
                        {/* Progress text */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-white drop-shadow-lg">
                            {sweepProgress}% - Computing {((sweepResolution + 1) * (sweepResolution + 1)).toLocaleString()} solutions
                          </span>
                        </div>
                      </div>
                      {/* Cancel hint */}
                      <p className="text-xxs text-gray-500 text-center">Analyzing solution space...</p>
                    </div>
                  ) : (
                    <button
                      onClick={runSweep}
                      disabled={!data || sweepCdaMin >= sweepCdaMax || sweepCrrMin >= sweepCrrMax}
                      className={`w-full py-2 rounded font-medium text-xs ${
                        data && sweepCdaMin < sweepCdaMax && sweepCrrMin < sweepCrrMax
                          ? 'bg-violet-600 hover:bg-violet-500 text-white'
                          : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Run Sweep
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Combined: Fitted Values + Results */}
        {(data || (method !== 'chung' && (data || data2))) && (
          <div className="card">
            <h3 className="label-sm mb-3">Results</h3>

            {/* CdA/Crr Sliders */}
            <div className="space-y-3 mb-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-green-400 font-medium">CdA</span>
                  <span className="font-mono font-bold">{cda.toFixed(4)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCda(Math.max(0.15, cda - cdaNudge))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-green-500/50 text-sm font-bold"
                    title={`-${cdaNudge}`}
                  >−</button>
                  <input type="range" min="0.15" max="0.5" step="0.0001" value={cda} onChange={e => setCda(parseFloat(e.target.value))} className="slider-cda flex-1" />
                  <button
                    onClick={() => setCda(Math.min(0.5, cda + cdaNudge))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-green-500/50 text-sm font-bold"
                    title={`+${cdaNudge}`}
                  >+</button>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xxs text-gray-500">Nudge:</span>
                  <select
                    value={cdaNudge}
                    onChange={e => setCdaNudge(parseFloat(e.target.value))}
                    className="text-xxs bg-dark-input border border-dark-border rounded px-1 py-0.5 text-gray-300"
                  >
                    <option value={0.0001}>0.0001</option>
                    <option value={0.0005}>0.0005</option>
                    <option value={0.001}>0.001</option>
                    <option value={0.005}>0.005</option>
                    <option value={0.01}>0.01</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-400 font-medium">Crr</span>
                  <span className="font-mono font-bold">{crr.toFixed(5)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCrr(Math.max(0.002, crr - crrNudge))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-blue-500/50 text-sm font-bold"
                    title={`-${crrNudge}`}
                  >−</button>
                  <input type="range" min="0.002" max="0.02" step="0.0001" value={crr} onChange={e => setCrr(parseFloat(e.target.value))} className="slider-crr flex-1" />
                  <button
                    onClick={() => setCrr(Math.min(0.02, crr + crrNudge))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-blue-500/50 text-sm font-bold"
                    title={`+${crrNudge}`}
                  >+</button>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xxs text-gray-500">Nudge:</span>
                  <select
                    value={crrNudge}
                    onChange={e => setCrrNudge(parseFloat(e.target.value))}
                    className="text-xxs bg-dark-input border border-dark-border rounded px-1 py-0.5 text-gray-300"
                  >
                    <option value={0.00001}>0.00001</option>
                    <option value={0.00005}>0.00005</option>
                    <option value={0.0001}>0.0001</option>
                    <option value={0.0005}>0.0005</option>
                    <option value={0.001}>0.001</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Railing Warning */}
            {isRailing && (
              <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded text-xs">
                <div className="flex items-center gap-2 text-yellow-400 font-medium mb-1">
                  <span>⚠️ Solution at bounds</span>
                </div>
                <div className="text-yellow-300/80 text-xxs space-y-0.5">
                  {railingDetails?.cdaAtLowerBound && <div>CdA at minimum ({cdaMin})</div>}
                  {railingDetails?.cdaAtUpperBound && <div>CdA at maximum ({cdaMax})</div>}
                  {railingDetails?.crrAtLowerBound && <div>Crr at minimum ({crrMin})</div>}
                  {railingDetails?.crrAtUpperBound && <div>Crr at maximum ({crrMax})</div>}
                </div>
                  <div className="text-gray-400 text-xxs mt-1">
                    Try adjusting bounds below
                  </div>
                </div>
              )}

            {/* Solver Bounds */}
            <details className="mb-3">
              <summary className="text-xxs text-gray-500 cursor-pointer hover:text-gray-300">Solver Bounds</summary>
              <div className="mt-2 p-2 bg-dark-bg rounded border border-dark-border space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xxs text-green-400">CdA Min</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cdaMin}
                      onChange={e => setCdaMin(parseFloat(e.target.value))}
                      className="w-full text-xxs bg-dark-input border border-dark-border rounded px-1.5 py-1 text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="text-xxs text-green-400">CdA Max</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cdaMax}
                      onChange={e => setCdaMax(parseFloat(e.target.value))}
                      className="w-full text-xxs bg-dark-input border border-dark-border rounded px-1.5 py-1 text-gray-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xxs text-blue-400">Crr Min</label>
                    <input
                      type="number"
                      step="0.001"
                      value={crrMin}
                      onChange={e => setCrrMin(parseFloat(e.target.value))}
                      className="w-full text-xxs bg-dark-input border border-dark-border rounded px-1.5 py-1 text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="text-xxs text-blue-400">Crr Max</label>
                    <input
                      type="number"
                      step="0.001"
                      value={crrMax}
                      onChange={e => setCrrMax(parseFloat(e.target.value))}
                      className="w-full text-xxs bg-dark-input border border-dark-border rounded px-1.5 py-1 text-gray-300"
                    />
                  </div>
                </div>
                <div className="text-xxs text-gray-500">
                  Tighter bounds can prevent degenerate solutions
                </div>
              </div>
            </details>

            {/* Fit Quality Metrics */}
            {method === 'chung' && sim && !sim.emptyRange && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 bg-dark-bg rounded border border-dark-border">
                <div className="flex justify-between">
                  <span className="text-gray-500">RMSE</span>
                  <span className={`font-mono font-bold ${sim.rmse < 1 ? 'text-emerald-400' : sim.rmse < 2 ? 'text-yellow-400' : 'text-red-400'}`}>{sim.rmse.toFixed(2)}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">R²</span>
                  <span className={`font-mono font-bold ${sim.r2 > 0.95 ? 'text-emerald-400' : sim.r2 > 0.9 ? 'text-yellow-400' : 'text-red-400'}`}>{(sim.r2 || 0).toFixed(4)}</span>
                </div>
              </div>
            )}

            {method === 'climb' && climbResult && (
              <div className="text-xs mb-3 p-2 bg-dark-bg rounded border border-dark-border space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">RMSE</span><span className={`font-mono ${climbResult.rmse < 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>{climbResult.rmse.toFixed(3)}m</span></div>
                <div className="flex justify-between"><span className="text-gray-500">R²</span><span className={`font-mono ${climbResult.r2 > 0.95 ? 'text-emerald-400' : 'text-yellow-400'}`}>{climbResult.r2.toFixed(4)}</span></div>
                <div className="text-xxs text-gray-500 pt-1 border-t border-dark-border">Low: {climbResult.avgSpeed1.toFixed(1)} km/h | High: {climbResult.avgSpeed2.toFixed(1)} km/h</div>
              </div>
            )}

            {method === 'shen' && shenResult && (
              <div className="text-xs mb-3 p-2 bg-dark-bg rounded border border-dark-border space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Bow</span><span className="font-mono text-amber-400">{shenResult.bow1.toFixed(2)}m / {shenResult.bow2.toFixed(2)}m</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Net</span><span className="font-mono text-amber-400">{shenResult.netElev1.toFixed(2)}m / {shenResult.netElev2.toFixed(2)}m</span></div>
                <div className="text-xxs text-gray-500 pt-1 border-t border-dark-border">Slow: {shenResult.avgSpeed1.toFixed(1)} km/h | Fast: {shenResult.avgSpeed2.toFixed(1)} km/h</div>
              </div>
            )}

            {method === 'sweep' && sweepResults && (
              <div className="text-xs mb-3 p-2 bg-dark-bg rounded border border-dark-border space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">RMSE Range</span><span className="font-mono"><span className="text-emerald-400">{sweepResults.minRmse.toFixed(2)}</span> - <span className="text-red-400">{sweepResults.maxRmse.toFixed(2)}m</span></span></div>
                <div className="text-xxs text-yellow-400 pt-1 border-t border-dark-border">
                  Many solutions in the green valley are equally valid
                </div>
                <div className="text-xxs text-gray-500">
                  {(sweepResults.cdaValues.length * sweepResults.crrValues.length).toLocaleString()} combinations tested
                </div>
              </div>
            )}

            {/* Save Button */}
            {((method === 'chung' && sim && !sim.emptyRange) || (method === 'climb' && climbResult) || (method === 'shen' && shenResult) || (method === 'sweep' && sweepResults)) && (
              <button
                onClick={() => setShowSavePreset(true)}
                className="w-full py-2 text-xs font-medium text-gray-300 hover:text-white border border-dark-border hover:border-brand-primary/50 rounded transition-all hover:bg-brand-primary/10 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save as Preset
              </button>
            )}
          </div>
        )}

        {/* Sweep Info Panel */}
        {method === 'sweep' && sweepResults && (
          <div className="card border-violet-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xxs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30 uppercase font-medium">2D Sweep</span>
              <h3 className="label-sm">Solution Space</h3>
            </div>
            <div className="text-xxs space-y-2">
              <p className="text-gray-400">
                <span className="text-emerald-400">Green = low RMSE</span> (good fit), <span className="text-red-400">Red = high RMSE</span> (poor fit).
              </p>
              <div className="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
                <p className="text-yellow-400 font-medium mb-1">Why is there a valley?</p>
                <p className="text-yellow-200/70">
                  With single-ride data, CdA and Crr are <span className="text-white">mathematically degenerate</span>. The diagonal valley shows that many different CdA/Crr combinations produce equally good fits.
                </p>
              </div>
              <div className="pt-2 border-t border-dark-border">
                <p className="text-gray-500 mb-1">What this means:</p>
                <ul className="text-gray-400 space-y-1 list-disc list-inside">
                  <li>Higher CdA + Lower Crr ≈ Lower CdA + Higher Crr</li>
                  <li>You <span className="text-red-400">cannot</span> uniquely determine both from one ride</li>
                  <li>Use <span className="text-cyan-400">Climb</span> or <span className="text-amber-400">Shen</span> methods for better separation</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Experimental Features */}
        {(data || ((method === 'climb' || method === 'shen') && (data || data2))) && (
          <div className="card border-yellow-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xxs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase font-medium">Beta</span>
              <h3 className="label-sm">Advanced</h3>
            </div>

            {/* Low-pass Filter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xxs text-gray-400">Low-pass Filter</span>
                <div className="flex gap-2">
                  <button onClick={() => setFilterGps(!filterGps)} className={`text-xxs px-2 py-0.5 rounded border ${filterGps ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'border-dark-border text-gray-500'}`}>GPS</button>
                  <button onClick={() => setFilterVirtual(!filterVirtual)} className={`text-xxs px-2 py-0.5 rounded border ${filterVirtual ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400' : 'border-dark-border text-gray-500'}`}>Virtual</button>
                </div>
              </div>
              {(filterGps || filterVirtual) && (
                <div>
                  <div className="flex justify-between text-xxs mb-1">
                    <span className="text-gray-500">Intensity</span>
                    <span className="text-white font-mono">{filterIntensity}</span>
                  </div>
                  <input type="range" min="1" max="10" value={filterIntensity} onChange={e => setFilterIntensity(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chart Area */}
      <div className="flex-1 flex flex-col">
        {/* Chart Controls */}
        {(data || ((method === 'climb' || method === 'shen') && data2)) && (
          <div className="px-6 py-2 border-b border-dark-border bg-dark-card/50">
            {method === 'chung' || method === 'sweep' ? (
              /* Single file mode controls (Chung/Sweep) */
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-bg/70">
                  <span className="text-xs text-gray-400">Range:</span>
                  {/* Start nudge buttons */}
                  <div className="flex items-center">
                    <button
                      onClick={() => setRange([Math.max(0, range[0] - 1), range[1]])}
                      className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-l border border-dark-border hover:bg-dark-input"
                      title="Move start back"
                    >◀</button>
                    <button
                      onClick={() => setRange([Math.min(range[1] - 1, range[0] + 1), range[1]])}
                      className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-r border-t border-b border-r border-dark-border hover:bg-dark-input"
                      title="Move start forward"
                    >▶</button>
                  </div>
                  <span className={`text-xs font-mono ${method === 'sweep' ? 'text-violet-400' : 'text-brand-accent'}`}>{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
                  {/* End nudge buttons */}
                  <div className="flex items-center">
                    <button
                      onClick={() => setRange([range[0], Math.max(range[0] + 1, range[1] - 1)])}
                      className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-l border border-dark-border hover:bg-dark-input"
                      title="Move end back"
                    >◀</button>
                    <button
                      onClick={() => setRange([range[0], Math.min(100, range[1] + 1)])}
                      className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-r border-t border-b border-r border-dark-border hover:bg-dark-input"
                      title="Move end forward"
                    >▶</button>
                  </div>
                  <button
                    onClick={() => setRange([0, 100])}
                    className="text-xxs text-gray-500 hover:text-white px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    title="Reset to full range"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setAutoScaleY(!autoScaleY)}
                    className={`text-xs font-semibold px-2 py-1 rounded border transition-colors ${
                      autoScaleY
                        ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                        : 'border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/40'
                    }`}
                    title="Auto-scale Y axis to visible data"
                  >
                    Autoscale Y: {autoScaleY ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => setShowRefLines(!showRefLines)}
                    className={`text-xs font-semibold px-2 py-1 rounded border transition-colors ${
                      showRefLines
                        ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                        : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                    }`}
                    title="Show start/max elevation reference lines"
                  >
                    Ref Lines: {showRefLines ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => setShowLapLines(!showLapLines)}
                    disabled={lapMarkers.length === 0}
                    className={`text-xs font-semibold px-2 py-1 rounded border transition-colors ${
                      lapMarkers.length === 0
                        ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                        : showLapLines
                          ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                          : 'border-amber-500/40 text-amber-300 hover:bg-amber-900/40'
                    }`}
                    title={lapMarkers.length > 0 ? 'Show/hide lap marker lines and labels' : 'No lap markers in this file'}
                  >
                    Lap Lines: {showLapLines ? 'On' : 'Off'}
                  </button>
                </div>
                {/* Lap cropping controls */}
                {lapMarkers.length > 0 && data && (() => {
                  const maxDist = data.dist[data.dist.length - 1]
                  const currentStartDist = distanceRange[0]
                  const currentEndDist = distanceRange[1]

                  // Find which lap index corresponds to current start/end
                  // Small tolerance for floating point precision
                  const tolerance = 0.1 // 0.1 meters

                  // Start: find the last lap that is at or before currentStartDist
                  let currentStartLapIdx = -1 // -1 means "Start"
                  for (let i = 0; i < lapMarkers.length; i++) {
                    if (lapMarkers[i].distance <= currentStartDist + tolerance) {
                      currentStartLapIdx = i
                    }
                  }

                  // End: find the first lap that is at or after currentEndDist, or -1 for "End"
                  let currentEndLapIdx = -1 // -1 means "End"
                  for (let i = lapMarkers.length - 1; i >= 0; i--) {
                    if (lapMarkers[i].distance >= currentEndDist - tolerance) {
                      currentEndLapIdx = i
                    }
                  }

                  return (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-bg/70">
                      <span className="text-xs text-amber-400">Lap Crop:</span>
                      <select
                        className="text-xxs bg-dark-input border border-dark-border rounded px-1.5 py-0.5 text-gray-300"
                        value={currentStartLapIdx}
                        onChange={(e) => {
                          const lapIdx = parseInt(e.target.value)
                          if (lapIdx === -1) {
                            applyDistanceCrop(0, currentEndDist)
                          } else {
                            const lapDist = lapMarkers[lapIdx].distance
                            applyDistanceCrop(lapDist, currentEndDist)
                          }
                        }}
                        title="Crop start to lap"
                      >
                        <option value={-1}>Start</option>
                        {lapMarkers.map((lap, idx) => (
                          // Only show laps before the current end lap
                          (currentEndLapIdx === -1 || idx < currentEndLapIdx) && (
                            <option key={idx} value={idx}>{lap.name}</option>
                          )
                        ))}
                      </select>
                      <span className="text-xxs text-gray-500">to</span>
                      <select
                        className="text-xxs bg-dark-input border border-dark-border rounded px-1.5 py-0.5 text-gray-300"
                        value={currentEndLapIdx}
                        onChange={(e) => {
                          const lapIdx = parseInt(e.target.value)
                          if (lapIdx === -1) {
                            applyDistanceCrop(currentStartDist, maxDist)
                          } else {
                            const lapDist = lapMarkers[lapIdx].distance
                            applyDistanceCrop(currentStartDist, lapDist)
                          }
                        }}
                        title="Crop end to lap"
                      >
                        {lapMarkers.map((lap, idx) => (
                          // Only show laps after the current start lap
                          idx > currentStartLapIdx && (
                            <option key={idx} value={idx}>{lap.name}</option>
                          )
                        ))}
                        <option value={-1}>End</option>
                      </select>
                    </div>
                  )
                })()}
                {method === 'sweep' && sweepResults && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-bg/70">
                    <span className="text-xxs px-2 py-0.5 rounded bg-violet-900/50 text-violet-400 border border-violet-500/30">
                      {(sweepResults.cdaValues.length * sweepResults.crrValues.length).toLocaleString()} solutions
                    </span>
                    <span className="text-xxs text-gray-500">Click heatmap to explore</span>
                    <span className="text-xxs px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-500/30">
                      Valley = degenerate solutions
                    </span>
                  </div>
                )}
                {(filterGps || filterVirtual) && (
                  <span className="text-xxs px-2 py-1 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-500/30">
                    Filtered
                  </span>
                )}
              </div>
            ) : method === 'shen' ? (
              /* Shen mode controls - dual file (slow/fast acceleration) */
              <div className="space-y-2">
                {/* Slow accel file controls */}
                {data && (
                  <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-bg/70">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider w-24">Slow Accel</span>
                    <span className="text-xxs font-mono text-amber-400">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
                    {sim && !sim.emptyRange && (
                      <span className="text-xxs text-amber-400 font-mono">Bow: {(currentBow || 0).toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange([0, 100])}
                      className="text-xxs text-gray-500 hover:text-amber-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* Fast accel file controls */}
                {data2 && (
                  <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-bg/70">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider w-24">Fast Accel</span>
                    <span className="text-xxs font-mono text-orange-400">{Math.round(distanceRange2[0])}m - {Math.round(distanceRange2[1])}m</span>
                    {sim2 && !sim2.emptyRange && (
                      <span className="text-xxs text-orange-400 font-mono">Bow: {(currentBow2 || 0).toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange2([0, 100])}
                      className="text-xxs text-gray-500 hover:text-orange-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* Shen result display */}
                {shenResult && (
                  <div className="flex items-center gap-4 pt-1 border-t border-dark-border mt-2 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-xxs text-gray-500 uppercase">Bow (Slow)</span>
                      <span className={`text-sm font-mono font-bold ${Math.abs(shenResult.bow1) < 0.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {shenResult.bow1.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-xxs text-gray-500 uppercase">Bow (Fast)</span>
                      <span className={`text-sm font-mono font-bold ${Math.abs(shenResult.bow2) < 0.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {shenResult.bow2.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-xxs text-gray-500 uppercase">Net (Slow)</span>
                      <span className={`text-sm font-mono font-bold ${Math.abs(shenResult.netElev1) < 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {shenResult.netElev1.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-xxs text-gray-500 uppercase">Net (Fast)</span>
                      <span className={`text-sm font-mono font-bold ${Math.abs(shenResult.netElev2) < 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {shenResult.netElev2.toFixed(2)}m
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Climb mode controls - still use sliders for two separate files */
              <div className="space-y-2">
                {/* Low speed file controls */}
                {data && (
                  <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-bg/70">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider w-24">Low Speed</span>
                    <span className="text-xxs font-mono text-cyan-400">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
                    {sim && !sim.emptyRange && (
                      <span className="text-xxs text-cyan-400 font-mono">RMSE: {sim.rmse.toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange([0, 100])}
                      className="text-xxs text-gray-500 hover:text-cyan-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* High speed file controls */}
                {data2 && (
                  <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-bg/70">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider w-24">High Speed</span>
                    <span className="text-xxs font-mono text-yellow-400">{Math.round(distanceRange2[0])}m - {Math.round(distanceRange2[1])}m</span>
                    {sim2 && !sim2.emptyRange && (
                      <span className="text-xxs text-yellow-400 font-mono">RMSE: {sim2.rmse.toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange2([0, 100])}
                      className="text-xxs text-gray-500 hover:text-yellow-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* Combined RMSE display */}
                {climbResult && (
                  <div className="flex items-center gap-4 pt-1 border-t border-dark-border mt-2">
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-xxs text-gray-500 uppercase">Combined RMSE</span>
                      <span className={`text-sm font-mono font-bold ${climbResult.rmse < 1 ? 'text-emerald-400' : climbResult.rmse < 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {climbResult.rmse.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-xxs text-gray-500 uppercase">R²</span>
                      <span className={`text-sm font-mono font-bold ${climbResult.r2 > 0.95 ? 'text-emerald-400' : climbResult.r2 > 0.9 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {climbResult.r2.toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1">
          {(data || ((method === 'climb' || method === 'shen') && data2)) ? (
            (sim && sim.emptyRange) || ((method === 'climb' || method === 'shen') && sim2 && sim2.emptyRange) ? (
              <div className="flex flex-col items-center justify-center h-full text-yellow-500 space-y-4">
                <p className="text-lg font-medium">Range too narrow</p>
                <p className="text-sm text-gray-500">Adjust the crop sliders</p>
              </div>
            ) : method === 'sweep' ? (
              /* Sweep mode: 2D Heatmap + Virtual elevation */
              <div className="flex flex-col h-full">
                {/* 2D Solution Space Heatmap */}
                {sweepResults && (
                  <div className="h-[45%] border-b border-dark-border">
                    <Plot
                      data={[
                        // Heatmap of RMSE values
                        {
                          x: sweepResults.cdaValues,
                          y: sweepResults.crrValues,
                          z: sweepResults.rmseGrid[0].map((_, colIdx) =>
                            sweepResults.rmseGrid.map(row => row[colIdx])
                          ),
                          type: 'heatmap',
                          colorscale: [
                            [0, '#10b981'],
                            [0.25, '#22d3ee'],
                            [0.5, '#eab308'],
                            [0.75, '#f97316'],
                            [1, '#ef4444']
                          ],
                          zmin: sweepResults.minRmse,
                          zmax: Math.min(sweepResults.maxRmse, sweepResults.minRmse * 3),
                          colorbar: {
                            title: 'RMSE (m)',
                            titleside: 'right',
                            thickness: 15,
                            len: 0.9
                          },
                          hovertemplate: 'CdA: %{x:.3f}<br>Crr: %{y:.5f}<br>RMSE: %{z:.3f}m<extra></extra>'
                        },
                        // Contour lines for better visualization
                        {
                          x: sweepResults.cdaValues,
                          y: sweepResults.crrValues,
                          z: sweepResults.rmseGrid[0].map((_, colIdx) =>
                            sweepResults.rmseGrid.map(row => row[colIdx])
                          ),
                          type: 'contour',
                          contours: {
                            coloring: 'lines',
                            showlabels: true,
                            labelfont: { size: 9, color: 'white' }
                          },
                          line: { color: 'rgba(255,255,255,0.3)', width: 1 },
                          showscale: false,
                          hoverinfo: 'skip'
                        },
                        // Current selection marker
                        {
                          x: [cda],
                          y: [crr],
                          mode: 'markers',
                          type: 'scatter',
                          name: 'Selected',
                          marker: { size: 16, color: '#f0abfc', symbol: 'x', line: { color: '#a855f7', width: 3 } },
                          hoverinfo: 'skip'
                        }
                      ]}
                      layout={{
                        autosize: true,
                        paper_bgcolor: '#0f172a',
                        plot_bgcolor: '#0f172a',
                        font: { color: '#94a3b8', size: 11 },
                        margin: { t: 40, l: 60, r: 80, b: 50 },
                        title: { text: 'CdA/Crr Solution Space (RMSE)', font: { size: 14, color: '#e2e8f0' } },
                        xaxis: { title: 'CdA (m²)', gridcolor: '#1e293b' },
                        yaxis: { title: 'Crr', gridcolor: '#1e293b' },
                        showlegend: true,
                        legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { size: 10 } },
                        hovermode: 'closest'
                      }}
                      onClick={handleSweepClick}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false, responsive: true }}
                    />
                  </div>
                )}
                {/* Virtual elevation chart */}
                <div className={sweepResults ? 'h-[55%]' : 'h-full'}>
                  <Plot
                    data={(() => {
                      if (!sim || sim.emptyRange) return []
                      const displayEle = filterGps ? lowPassFilter(data.ele, filterIntensity) : data.ele
                      const displayVEle = filterVirtual ? lowPassFilter(sim.vEle, filterIntensity) : sim.vEle

                      return [
                        { x: data.dist, y: displayEle, type: 'scatter', mode: 'lines', name: 'GPS Elev', line: { color: '#ef4444', width: 2 }, opacity: 0.6 },
                        { x: data.dist, y: displayVEle, type: 'scatter', mode: 'lines', name: 'Virtual Elev', line: { color: '#a78bfa', width: 2 } },
                        { x: data.dist, y: sim.err, type: 'scatter', mode: 'lines', name: 'Delta', line: { color: '#a855f7', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy' }
                      ]
                    })()}
                    layout={{
                      autosize: true,
                      paper_bgcolor: '#0f172a',
                      plot_bgcolor: '#0f172a',
                      font: { color: '#94a3b8', size: 11 },
                      margin: { t: 30, l: 50, r: 20, b: 40 },
                      grid: { rows: 2, columns: 1, pattern: 'independent' },
                      showlegend: true,
                      legend: { orientation: 'h', y: 1.02, x: 0, font: { size: 10 } },
                      xaxis: { title: 'Distance (m)', gridcolor: '#1e293b', range: distanceRange },
                      yaxis: { title: 'Elevation (m)', gridcolor: '#1e293b', domain: [0.35, 1] },
                      yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', anchor: 'x', domain: [0, 0.28] }
                    }}
                    onRelayout={handleRelayout}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: true, responsive: true, doubleClick: 'reset', modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
                  />
                </div>
              </div>
            ) : method === 'chung' ? (
              /* Single file chart with rangeslider (Chung only) */
              <Plot
                data={(() => {
                  // Use full data for rangeslider visibility
                  const displayEle = filterGps ? lowPassFilter(data.ele, filterIntensity) : data.ele
                  const displayVEle = filterVirtual ? lowPassFilter(sim.vEle, filterIntensity) : sim.vEle

                  return [
                    { x: data.dist, y: displayEle, type: 'scatter', mode: 'lines', name: 'GPS Elev', line: { color: '#ef4444', width: 2 }, opacity: 0.6 },
                    { x: data.dist, y: displayVEle, type: 'scatter', mode: 'lines', name: 'Virtual Elev', line: { color: '#06b6d4', width: 2 } },
                    { x: data.dist, y: sim.err, type: 'scatter', mode: 'lines', name: 'Delta', line: { color: '#a855f7', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy' },
                    { x: data.dist, y: data.pwr, type: 'scatter', mode: 'lines', name: 'Power', line: { color: '#f97316', width: 1 }, xaxis: 'x', yaxis: 'y3', fill: 'tozeroy', opacity: 0.3 }
                  ]
                })()}
                layout={layout}
                onRelayout={handleRelayout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, responsive: true, doubleClick: 'reset', modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
              />
            ) : method === 'shen' ? (
              /* Shen mode chart - show both acceleration files */
              <Plot
                data={(() => {
                  const traces = []

                  // Slow accel file (file 1) - amber colors
                  if (data && sim && !sim.emptyRange) {
                    const displayEle1 = filterGps ? lowPassFilter(data.ele, filterIntensity) : data.ele
                    const displayVEle1 = filterVirtual ? lowPassFilter(sim.vEle, filterIntensity) : sim.vEle

                    traces.push({ x: data.dist, y: displayEle1, type: 'scatter', mode: 'lines', name: 'GPS (Slow)', line: { color: '#ef4444', width: 2 }, opacity: 0.6 })
                    traces.push({ x: data.dist, y: displayVEle1, type: 'scatter', mode: 'lines', name: 'VE Slow Accel', line: { color: '#f59e0b', width: 2 } })
                    traces.push({ x: data.dist, y: sim.err, type: 'scatter', mode: 'lines', name: 'Err Slow', line: { color: '#f59e0b', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy', opacity: 0.5 })
                  }

                  // Fast accel file (file 2) - orange colors
                  if (data2 && sim2 && !sim2.emptyRange) {
                    const displayEle2 = filterGps ? lowPassFilter(data2.ele, filterIntensity) : data2.ele
                    const displayVEle2 = filterVirtual ? lowPassFilter(sim2.vEle, filterIntensity) : sim2.vEle

                    // Only show GPS if file 1 not loaded
                    if (!data) {
                      traces.push({ x: data2.dist, y: displayEle2, type: 'scatter', mode: 'lines', name: 'GPS (Fast)', line: { color: '#ef4444', width: 2 }, opacity: 0.6 })
                    }
                    traces.push({ x: data2.dist, y: displayVEle2, type: 'scatter', mode: 'lines', name: 'VE Fast Accel', line: { color: '#ea580c', width: 2 } })
                    traces.push({ x: data2.dist, y: sim2.err, type: 'scatter', mode: 'lines', name: 'Err Fast', line: { color: '#ea580c', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy', opacity: 0.5 })
                  }

                  return traces
                })()}
                layout={{
                  ...layout,
                  grid: { rows: 2, columns: 1, pattern: 'independent' },
                  yaxis: { title: 'Elevation (m)', gridcolor: '#1e293b', domain: [0.52, 1] },
                  yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', anchor: 'x', domain: [0.08, 0.45] },
                }}
                onRelayout={handleRelayout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, responsive: true, doubleClick: 'reset', modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
              />
            ) : (
              /* Climb mode chart - show both files with rangeslider */
              <Plot
                data={(() => {
                  const traces = []

                  // Low speed file (file 1) - cyan colors - use full data
                  if (data && sim && !sim.emptyRange) {
                    const displayEle1 = filterGps ? lowPassFilter(data.ele, filterIntensity) : data.ele
                    const displayVEle1 = filterVirtual ? lowPassFilter(sim.vEle, filterIntensity) : sim.vEle

                    traces.push({ x: data.dist, y: displayEle1, type: 'scatter', mode: 'lines', name: 'GPS (Low)', line: { color: '#ef4444', width: 2 }, opacity: 0.6 })
                    traces.push({ x: data.dist, y: displayVEle1, type: 'scatter', mode: 'lines', name: 'VE Low Speed', line: { color: '#06b6d4', width: 2 } })
                    traces.push({ x: data.dist, y: sim.err, type: 'scatter', mode: 'lines', name: 'Err Low', line: { color: '#06b6d4', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy', opacity: 0.5 })
                  }

                  // High speed file (file 2) - yellow colors - use full data
                  if (data2 && sim2 && !sim2.emptyRange) {
                    const displayEle2 = filterGps ? lowPassFilter(data2.ele, filterIntensity) : data2.ele
                    const displayVEle2 = filterVirtual ? lowPassFilter(sim2.vEle, filterIntensity) : sim2.vEle

                    // Only show GPS if file 1 not loaded (they should be same climb)
                    if (!data) {
                      traces.push({ x: data2.dist, y: displayEle2, type: 'scatter', mode: 'lines', name: 'GPS (High)', line: { color: '#ef4444', width: 2 }, opacity: 0.6 })
                    }
                    traces.push({ x: data2.dist, y: displayVEle2, type: 'scatter', mode: 'lines', name: 'VE High Speed', line: { color: '#eab308', width: 2 } })
                    traces.push({ x: data2.dist, y: sim2.err, type: 'scatter', mode: 'lines', name: 'Err High', line: { color: '#eab308', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy', opacity: 0.5 })
                  }

                  return traces
                })()}
                layout={{
                  ...layout,
                  grid: { rows: 2, columns: 1, pattern: 'independent' },
                  yaxis: { title: 'Elevation (m)', gridcolor: '#1e293b', domain: [0.52, 1] },
                  yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', anchor: 'x', domain: [0.08, 0.45] },
                }}
                onRelayout={handleRelayout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, responsive: true, doubleClick: 'reset', modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <svg className="w-16 h-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-center">
                <p className="text-lg">Upload a GPX/FIT file to analyze</p>
                <p className="text-sm text-gray-600 mt-1">Quick test lets you analyze a single ride without saving</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Preset Modal */}
      {showSavePreset && presetsHook && (
        <SavePresetModal
          values={{
            cda,
            crr,
            mass,
            efficiency: eff,
            rho
          }}
          onSave={presetsHook.createPreset}
          onClose={() => setShowSavePreset(false)}
        />
      )}

      <AlertDialog
        isOpen={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, message: '' })}
        title="Error"
        message={errorDialog.message}
        variant="error"
      />
    </div>
  )
}
