import { useState, useMemo, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import { parseGPX } from '../../lib/gpxParser'
import { solveCdaCrr, solveCdaCrrClimb, solveCdaCrrShenDual, solveCdaCrrSweep, checkSteadyAcceleration, calculateBow, safeNum, GRAVITY } from '../../lib/physics'
import { lowPassFilter } from '../../lib/preprocessing'
import { calculateAirDensity } from '../../lib/airDensity'
import { SavePresetModal } from '../presets'

export const QuickTestTab = ({ presetsHook }) => {
  const { user } = useAuth()
  const { trackFeature } = useAnalytics()
  const { isFeatureEnabled, isAdmin } = useFeatureFlags()

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

  const [data, setData] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [hasPowerData, setHasPowerData] = useState(true)

  // Second file state (for climb mode)
  const [data2, setData2] = useState(null)
  const [startTime2, setStartTime2] = useState(null)
  const [fileName2, setFileName2] = useState(null)
  const [hasPowerData2, setHasPowerData2] = useState(true)

  // Per-file ranges (for climb mode)
  const [range2, setRange2] = useState([0, 100])

  // Per-file offsets (for climb mode)
  const [offset2, setOffset2] = useState(0)

  // Climb mode result
  const [climbResult, setClimbResult] = useState(null)

  // Environment
  const [wSpd, setWSpd] = useState(0)
  const [wDir, setWDir] = useState(0)
  const [offset, setOffset] = useState(0)
  const [range, setRange] = useState([0, 100])

  // Solver
  const [method, setMethod] = useState('chung') // 'chung' or 'shen'
  const [busy, setBusy] = useState(false)
  const [fetchingW, setFetchingW] = useState(false)
  const [weatherError, setWeatherError] = useState(null)
  const [maxIterations, setMaxIterations] = useState(500)

  // Low-pass filter (for display only)
  const [filterGps, setFilterGps] = useState(false)
  const [filterVirtual, setFilterVirtual] = useState(false)
  const [filterIntensity, setFilterIntensity] = useState(5)

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

  // File Handler for first file
  const onFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    const r = new FileReader()
    r.onload = (ev) => {
      const result = parseGPX(ev.target.result)
      setData(result.data)
      setStartTime(result.startTime)
      setHasPowerData(result.hasPowerData)
    }
    r.readAsText(f)
  }

  // File Handler for second file (climb mode)
  const onFile2 = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName2(f.name)
    const r = new FileReader()
    r.onload = (ev) => {
      const result = parseGPX(ev.target.result)
      setData2(result.data)
      setStartTime2(result.startTime)
      setHasPowerData2(result.hasPowerData)
    }
    r.readAsText(f)
  }

  // Reset analysis
  const resetAnalysis = () => {
    setData(null)
    setFileName(null)
    setStartTime(null)
    setHasPowerData(true)
    setData2(null)
    setFileName2(null)
    setStartTime2(null)
    setHasPowerData2(true)
    setCda(0.32)
    setCrr(0.004)
    setWSpd(0)
    setWDir(0)
    setOffset(0)
    setOffset2(0)
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

  // Simulation calculation - compute full virtual elevation for display
  const sim = useMemo(() => {
    if (!data) return null
    const { pwr, v, a, ds, ele, b } = data
    const sIdx = Math.floor((range[0] / 100) * pwr.length)
    const eIdx = Math.floor((range[1] / 100) * pwr.length)

    if (sIdx >= eIdx || eIdx - sIdx < 2) {
      return { vEle: [], err: [], sIdx, eIdx, rmse: 0, anomalies: [], emptyRange: true }
    }

    // Compute virtual elevation for FULL dataset (for rangeslider display)
    const vEle = new Array(pwr.length).fill(0)
    const err = new Array(pwr.length).fill(0)

    // For Shen method: start at 0 (flat ground assumption)
    // For other methods: start at GPS elevation
    const startElev = method === 'shen' ? 0 : ele[0]
    vEle[0] = startElev
    let cur = startElev

    const iOff = Math.round(offset)
    const wRad = wDir * (Math.PI / 180)

    // Calculate full virtual elevation
    for (let i = 0; i < pwr.length; i++) {
      const vg = Math.max(0.1, v[i])
      let pi = i - iOff
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1

      const pw = pwr[pi] * eff
      const rh = rho * Math.exp(-ele[i] / 9000)
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

    // Calculate RMSE and R² only within the selected range
    let sqSum = 0, cnt = 0, ssTot = 0
    let eleSum = 0
    for (let i = sIdx; i < eIdx; i++) {
      eleSum += ele[i]
    }
    const eleMean = eleSum / (eIdx - sIdx)

    for (let i = sIdx; i < eIdx; i++) {
      const errVal = method === 'shen' ? vEle[i] : err[i]
      sqSum += errVal * errVal
      ssTot += (ele[i] - eleMean) ** 2
      cnt++
    }

    const rmse = cnt > 0 ? Math.sqrt(sqSum / cnt) : 0
    const r2 = ssTot > 0 ? 1 - (sqSum / ssTot) : 0

    // Calculate net elevation for Shen method
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
      const vg = Math.max(0.1, v[i])
      let pi = i - iOff
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1

      const pw = pwr[pi] * eff
      const rh = rho * Math.exp(-ele[i] / 9000)
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

  // Check if data is suitable for Shen method (steady acceleration)
  const accelCheck = useMemo(() => {
    if (!data || !sim || sim.emptyRange) return null
    return checkSteadyAcceleration(data, sim.sIdx, sim.eIdx)
  }, [data, sim])

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
    trackFeature('chung_solver')
    setTimeout(() => {
      const res = solveCdaCrr(data, sim.sIdx, sim.eIdx, cda, crr, mass, eff, rho, offset, wSpd, wDir, { method: 'chung', maxIterations })
      setCda(res.cda)
      setCrr(res.crr)
      setBusy(false)
    }, 50)
  }

  const runShen = () => {
    // Shen method requires two files (slow and fast acceleration)
    if (!data || !data2 || !sim || !sim2) return
    setBusy(true)
    setShenResult(null)
    trackFeature('shen_solver')
    setTimeout(() => {
      const res = solveCdaCrrShenDual(
        data, sim.sIdx, sim.eIdx,
        data2, sim2.sIdx, sim2.eIdx,
        cda, crr,
        mass, eff, rho,
        offset, offset2,
        wSpd, wDir,
        { maxIterations }
      )
      setCda(res.cda)
      setCrr(res.crr)
      setShenResult(res)
      setBusy(false)
    }, 50)
  }

  const runClimb = () => {
    if (!data || !data2 || !sim || !sim2) return
    setBusy(true)
    setClimbResult(null)
    trackFeature('climb_solver')
    setTimeout(() => {
      const res = solveCdaCrrClimb(
        data, sim.sIdx, sim.eIdx,
        data2, sim2.sIdx, sim2.eIdx,
        cda, crr,
        mass, eff, rho,
        offset, offset2,
        wSpd, wDir,
        { maxIterations }
      )
      setCda(res.cda)
      setCrr(res.crr)
      setClimbResult(res)
      setBusy(false)
    }, 50)
  }

  const runSweep = async () => {
    if (!data || !sim) return
    setSweepBusy(true)
    setSweepResults(null)
    setSweepProgress(0)
    trackFeature('sweep_solver', { resolution: sweepResolution })

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
    setFetchingW(true)
    setWeatherError(null)
    try {
      const mid = Math.floor(data.lat.length / 2)
      const ds = startTime.toISOString().split('T')[0]
      const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${data.lat[mid]}&longitude=${data.lon[mid]}&start_date=${ds}&end_date=${ds}&hourly=wind_speed_10m,wind_direction_10m`
      const r = await fetch(u)
      if (!r.ok) throw new Error('Weather service unavailable')
      const j = await r.json()
      if (j.hourly) {
        const h = startTime.getUTCHours()
        if (j.hourly.wind_speed_10m[h] !== undefined) {
          setWSpd(parseFloat((j.hourly.wind_speed_10m[h] / 3.6 * 0.6).toFixed(2)))
          setWDir(j.hourly.wind_direction_10m[h])
        } else {
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
  const distanceRange = useMemo(() => {
    if (!data) return [0, 0]
    const maxDist = data.dist[data.dist.length - 1]
    return [
      (range[0] / 100) * maxDist,
      (range[1] / 100) * maxDist
    ]
  }, [data, range])

  const distanceRange2 = useMemo(() => {
    if (!data2) return [0, 0]
    const maxDist = data2.dist[data2.dist.length - 1]
    return [
      (range2[0] / 100) * maxDist,
      (range2[1] / 100) * maxDist
    ]
  }, [data2, range2])

  // Handle rangeslider changes for file 1
  const handleRelayout = useCallback((eventData) => {
    if (!data) return
    const maxDist = data.dist[data.dist.length - 1]

    if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
      const newStart = Math.max(0, eventData['xaxis.range[0]'])
      const newEnd = Math.min(maxDist, eventData['xaxis.range[1]'])
      const startPct = Math.round((newStart / maxDist) * 100)
      const endPct = Math.round((newEnd / maxDist) * 100)
      if (startPct !== range[0] || endPct !== range[1]) {
        setRange([Math.max(0, startPct), Math.min(100, endPct)])
      }
    }
    if (eventData['xaxis.range']) {
      const [newStart, newEnd] = eventData['xaxis.range']
      const startPct = Math.round((Math.max(0, newStart) / maxDist) * 100)
      const endPct = Math.round((Math.min(maxDist, newEnd) / maxDist) * 100)
      if (startPct !== range[0] || endPct !== range[1]) {
        setRange([Math.max(0, startPct), Math.min(100, endPct)])
      }
    }
  }, [data, range])

  // Chart layout with rangeslider
  const layout = useMemo(() => ({
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
      range: distanceRange,
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
    yaxis: { title: 'Elevation (m)', gridcolor: '#1e293b', domain: [0.55, 1] },
    yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', domain: [0.30, 0.50] },
    yaxis3: { title: 'Power (W)', gridcolor: '#1e293b', domain: [0.08, 0.26] },
    shapes: [],
    annotations: []
  }), [distanceRange])

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
            Analyze a single GPX file to calculate your CdA and Crr values. Create an account to get started.
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
                Upload GPX File
                <input type="file" accept=".gpx" onChange={onFile} className="hidden" />
              </label>
              {!data && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  {method === 'sweep' ? (
                    <>Upload a GPX to visualize <span className="text-violet-400">all possible solutions</span></>
                  ) : (
                    <>Upload a GPX for <span className="text-indigo-400">Chung</span> analysis</>
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
                    {fileName ? 'Change Slow Accel GPX' : 'Upload Slow Accel GPX'}
                    <input type="file" accept=".gpx" onChange={onFile} className="hidden" />
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
                    {fileName2 ? 'Change Fast Accel GPX' : 'Upload Fast Accel GPX'}
                    <input type="file" accept=".gpx" onChange={onFile2} className="hidden" />
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
                    {fileName ? 'Change Low Speed GPX' : 'Upload Low Speed GPX'}
                    <input type="file" accept=".gpx" onChange={onFile} className="hidden" />
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
                    {fileName2 ? 'Change High Speed GPX' : 'Upload High Speed GPX'}
                    <input type="file" accept=".gpx" onChange={onFile2} className="hidden" />
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
                  Upload two GPX files from the same climb
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
                    onClick={() => setCda(Math.max(0.15, cda - 0.001))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-green-500/50 text-sm font-bold"
                  >−</button>
                  <input type="range" min="0.15" max="0.5" step="0.0001" value={cda} onChange={e => setCda(parseFloat(e.target.value))} className="slider-cda flex-1" />
                  <button
                    onClick={() => setCda(Math.min(0.5, cda + 0.001))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-green-500/50 text-sm font-bold"
                  >+</button>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-400 font-medium">Crr</span>
                  <span className="font-mono font-bold">{crr.toFixed(5)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCrr(Math.max(0.002, crr - 0.0001))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-blue-500/50 text-sm font-bold"
                  >−</button>
                  <input type="range" min="0.002" max="0.02" step="0.0001" value={crr} onChange={e => setCrr(parseFloat(e.target.value))} className="slider-crr flex-1" />
                  <button
                    onClick={() => setCrr(Math.min(0.02, crr + 0.0001))}
                    className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-blue-500/50 text-sm font-bold"
                  >+</button>
                </div>
              </div>
            </div>

            {/* Fit Quality Metrics */}
            {method === 'chung' && sim && sim.r2 > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 bg-dark-bg rounded border border-dark-border">
                <div className="flex justify-between">
                  <span className="text-gray-500">RMSE</span>
                  <span className={`font-mono font-bold ${sim.rmse < 1 ? 'text-emerald-400' : sim.rmse < 2 ? 'text-yellow-400' : 'text-red-400'}`}>{sim.rmse.toFixed(2)}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">R²</span>
                  <span className={`font-mono font-bold ${sim.r2 > 0.95 ? 'text-emerald-400' : sim.r2 > 0.9 ? 'text-yellow-400' : 'text-red-400'}`}>{sim.r2.toFixed(4)}</span>
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
            {((method === 'chung' && sim && sim.r2 > 0) || (method === 'climb' && climbResult) || (method === 'shen' && shenResult) || (method === 'sweep' && sweepResults)) && (
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

            {/* Wind */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Wind Correction</span>
              <button
                onClick={getWeather}
                disabled={fetchingW}
                className="btn-secondary text-xxs py-1 px-3"
              >
                {fetchingW ? 'Fetching...' : 'Fetch Weather'}
              </button>
            </div>
            {weatherError && (
              <p className="text-xxs text-red-400 mb-2">{weatherError}</p>
            )}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xxs text-gray-500 mb-1 block">Speed (m/s)</label>
                <input type="number" step="0.1" value={wSpd} onChange={e => setWSpd(safeNum(e.target.value, wSpd))} className="input-dark w-full" />
              </div>
              <div>
                <label className="text-xxs text-gray-500 mb-1 block">Direction (°)</label>
                <input type="number" step="1" value={wDir} onChange={e => setWDir(safeNum(e.target.value, wDir))} className="input-dark w-full" />
              </div>
            </div>

            {/* Time Lag */}
            {method === 'chung' ? (
              <div>
                <div className="flex justify-between text-xxs mb-1">
                  <span className="text-orange-400">Time Lag</span>
                  <span className="text-gray-400">{offset}s</span>
                </div>
                <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className="slider-lag" />
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xxs mb-1">
                    <span className={method === 'shen' ? 'text-amber-400' : 'text-cyan-400'}>{method === 'shen' ? 'Slow' : 'Low'} Lag</span>
                    <span className="text-gray-400">{offset}s</span>
                  </div>
                  <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className={`w-full ${method === 'shen' ? 'accent-amber-500' : 'accent-cyan-500'}`} />
                </div>
                <div>
                  <div className="flex justify-between text-xxs mb-1">
                    <span className={method === 'shen' ? 'text-orange-400' : 'text-yellow-400'}>{method === 'shen' ? 'Fast' : 'High'} Lag</span>
                    <span className="text-gray-400">{offset2}s</span>
                  </div>
                  <input type="range" min="-5" max="5" step="0.5" value={offset2} onChange={e => setOffset2(parseFloat(e.target.value))} className={`w-full ${method === 'shen' ? 'accent-orange-500' : 'accent-yellow-500'}`} />
                </div>
              </div>
            )}

            {/* Low-pass Filter */}
            <div className="mt-3 pt-3 border-t border-dark-border">
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
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Range:</span>
                  <span className={`text-xs font-mono ${method === 'sweep' ? 'text-violet-400' : 'text-brand-accent'}`}>{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
                  <button
                    onClick={() => setRange([0, 100])}
                    className="text-xxs text-gray-500 hover:text-white px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    title="Reset to full range"
                  >
                    Reset
                  </button>
                </div>
                {method === 'sweep' && sweepResults && (
                  <div className="flex items-center gap-2">
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
                  <span className="text-xxs px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-500/30">
                    Filtered
                  </span>
                )}
              </div>
            ) : method === 'shen' ? (
              /* Shen mode controls - dual file (slow/fast acceleration) */
              <div className="space-y-2">
                {/* Slow accel file controls */}
                {data && (
                  <div className="flex items-center gap-4">
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
                  <div className="flex items-center gap-4">
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
                  <div className="flex items-center gap-4">
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
                  <div className="flex items-center gap-4">
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
                      yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', domain: [0, 0.28] }
                    }}
                    onRelayout={handleRelayout}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
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
                config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
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
                  yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', domain: [0.08, 0.45] },
                }}
                onRelayout={handleRelayout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
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
                  yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', domain: [0.08, 0.45] },
                }}
                onRelayout={handleRelayout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <svg className="w-16 h-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-center">
                <p className="text-lg">Upload a GPX file to analyze</p>
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
    </div>
  )
}
