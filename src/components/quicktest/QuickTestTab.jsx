import { useState, useMemo, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { useAuth } from '../../hooks/useAuth.jsx'
import { parseGPX } from '../../lib/gpxParser'
import { solveCdaCrr, solveCdaCrrClimb, solveCdaCrrShenDual, checkSteadyAcceleration, calculateBow, safeNum, GRAVITY } from '../../lib/physics'
import { lowPassFilter } from '../../lib/preprocessing'
import { calculateAirDensity } from '../../lib/airDensity'
import { SavePresetModal } from '../presets'

export const QuickTestTab = ({ presetsHook }) => {
  const { user } = useAuth()
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
  const [maxIterations, setMaxIterations] = useState(500)

  // Low-pass filter (for display only)
  const [filterGps, setFilterGps] = useState(false)
  const [filterVirtual, setFilterVirtual] = useState(false)
  const [filterIntensity, setFilterIntensity] = useState(5)

  // Shen method state
  const [shenResult, setShenResult] = useState(null)

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

  const getWeather = async () => {
    if (!data || !startTime) return
    setFetchingW(true)
    try {
      const mid = Math.floor(data.lat.length / 2)
      const ds = startTime.toISOString().split('T')[0]
      const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${data.lat[mid]}&longitude=${data.lon[mid]}&start_date=${ds}&end_date=${ds}&hourly=wind_speed_10m,wind_direction_10m`
      const r = await fetch(u)
      const j = await r.json()
      if (j.hourly) {
        const h = startTime.getUTCHours()
        if (j.hourly.wind_speed_10m[h] !== undefined) {
          setWSpd(parseFloat((j.hourly.wind_speed_10m[h] / 3.6 * 0.6).toFixed(2)))
          setWDir(j.hourly.wind_direction_10m[h])
        }
      }
    } catch (e) { console.error(e) }
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
    xaxis: {
      title: 'Distance (m)',
      gridcolor: '#1e293b',
      anchor: 'y3',
      range: distanceRange,
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
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please sign in to use Quick Test</p>
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
          {method === 'chung' ? (
            <>
              <label className="block w-full cursor-pointer bg-brand-primary hover:bg-indigo-600 text-white text-center py-2.5 rounded font-medium transition-colors">
                Upload GPX File
                <input type="file" accept=".gpx" onChange={onFile} className="hidden" />
              </label>
              {!data && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Upload a GPX for <span className="text-indigo-400">Chung</span> analysis
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
                    <p className="text-center text-[10px] text-amber-400 mt-1 truncate">{fileName}</p>
                  )}
                  {fileName && !hasPowerData && (
                    <p className="text-center text-[10px] text-yellow-500 mt-1">No power data</p>
                  )}
                </div>

                {/* Fast Acceleration File */}
                <div>
                  <label className="block w-full cursor-pointer bg-orange-600 hover:bg-orange-500 text-white text-center py-2 rounded font-medium text-sm transition-colors">
                    {fileName2 ? 'Change Fast Accel GPX' : 'Upload Fast Accel GPX'}
                    <input type="file" accept=".gpx" onChange={onFile2} className="hidden" />
                  </label>
                  {fileName2 && (
                    <p className="text-center text-[10px] text-orange-400 mt-1 truncate">{fileName2}</p>
                  )}
                  {fileName2 && !hasPowerData2 && (
                    <p className="text-center text-[10px] text-yellow-500 mt-1">No power data</p>
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
                    <p className="text-center text-[10px] text-cyan-400 mt-1 truncate">{fileName}</p>
                  )}
                  {fileName && !hasPowerData && (
                    <p className="text-center text-[10px] text-yellow-500 mt-1">No power data</p>
                  )}
                </div>

                {/* High Speed File */}
                <div>
                  <label className="block w-full cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white text-center py-2 rounded font-medium text-sm transition-colors">
                    {fileName2 ? 'Change High Speed GPX' : 'Upload High Speed GPX'}
                    <input type="file" accept=".gpx" onChange={onFile2} className="hidden" />
                  </label>
                  {fileName2 && (
                    <p className="text-center text-[10px] text-yellow-400 mt-1 truncate">{fileName2}</p>
                  )}
                  {fileName2 && !hasPowerData2 && (
                    <p className="text-center text-[10px] text-yellow-500 mt-1">No power data</p>
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

        {/* Method Selection - MUST be chosen before uploading file */}
        <div className="card">
          <h3 className="label-sm mb-2">Analysis Method</h3>
          <div className={`flex bg-dark-input p-0.5 rounded border border-dark-border ${(data || data2) ? 'opacity-50' : ''}`}>
            <button
              onClick={() => { if (!data && !data2) setMethod('chung') }}
              disabled={!!(data || data2)}
              className={`px-2 py-1.5 rounded text-[10px] font-medium flex-1 transition-colors ${method === 'chung' ? 'bg-indigo-600 text-white' : 'text-gray-400'} ${(data || data2) ? 'cursor-not-allowed' : ''}`}
            >
              Chung
            </button>
            <button
              onClick={() => { if (!data && !data2) setMethod('shen') }}
              disabled={!!(data || data2)}
              className={`px-2 py-1.5 rounded text-[10px] font-medium flex-1 transition-colors ${method === 'shen' ? 'bg-amber-600 text-white' : 'text-gray-400'} ${(data || data2) ? 'cursor-not-allowed' : ''}`}
            >
              Shen
            </button>
            <button
              onClick={() => { if (!data && !data2) setMethod('climb') }}
              disabled={!!(data || data2)}
              className={`px-2 py-1.5 rounded text-[10px] font-medium flex-1 transition-colors ${method === 'climb' ? 'bg-emerald-600 text-white' : 'text-gray-400'} ${(data || data2) ? 'cursor-not-allowed' : ''}`}
            >
              Climb
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            {method === 'chung'
              ? 'Standard method for typical rides with varying speeds.'
              : method === 'shen'
              ? 'Two acceleration runs on FLAT ground. Goal: virtual elevation is both STRAIGHT (no bow) and LEVEL (net ≈ 0).'
              : 'Two files from same climb at different speeds for better CdA/Crr separation.'}
          </p>
          {(data || data2) && (
            <p className="text-[10px] text-yellow-500 mt-1">Clear file(s) to change method</p>
          )}
        </div>

        {/* Physics Inputs */}
        <div className="card">
          <h3 className="label-sm mb-3">System Parameters</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Total Mass (kg)</label>
              <input
                type="number"
                step="0.1"
                value={mass}
                onChange={e => setMass(safeNum(e.target.value, mass))}
                className="input-dark w-full"
              />
              <p className="text-[10px] text-gray-600 mt-0.5">Rider + bike + gear</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Drivetrain Efficiency</label>
              <input
                type="number"
                step="0.01"
                min="0.9"
                max="1"
                value={eff}
                onChange={e => setEff(safeNum(e.target.value, eff))}
                className="input-dark w-full"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500">Air Density (kg/m³)</label>
                <button
                  onClick={() => setShowRhoCalc(!showRhoCalc)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300"
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
              <p className="text-[10px] text-gray-600 mt-0.5">Sea level @ 15°C: 1.225</p>

              {/* Air Density Calculator */}
              {showRhoCalc && (
                <div className="mt-3 p-3 bg-dark-bg rounded border border-dark-border space-y-3">
                  <p className="text-[10px] text-gray-400 font-medium">Calculate from conditions:</p>

                  {/* Temperature */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={rhoTemp}
                      onChange={e => setRhoTemp(safeNum(e.target.value, rhoTemp))}
                      className="input-dark w-full"
                    />
                  </div>

                  {/* Pressure Mode Toggle */}
                  <div>
                    <div className="flex bg-dark-input p-0.5 rounded border border-dark-border mb-2">
                      <button
                        onClick={() => setRhoUseElevation(true)}
                        className={`px-2 py-1 rounded text-[10px] font-medium flex-1 ${rhoUseElevation ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                      >
                        Elevation
                      </button>
                      <button
                        onClick={() => setRhoUseElevation(false)}
                        className={`px-2 py-1 rounded text-[10px] font-medium flex-1 ${!rhoUseElevation ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                      >
                        Pressure
                      </button>
                    </div>

                    {rhoUseElevation ? (
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Elevation (m)</label>
                        <input
                          type="number"
                          step="1"
                          value={rhoElevation}
                          onChange={e => setRhoElevation(safeNum(e.target.value, rhoElevation))}
                          className="input-dark w-full"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Pressure (hPa)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={rhoPressure}
                          onChange={e => setRhoPressure(safeNum(e.target.value, rhoPressure))}
                          className="input-dark w-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* Humidity */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Relative Humidity (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={rhoHumidity}
                      onChange={e => setRhoHumidity(safeNum(e.target.value, rhoHumidity))}
                      className="input-dark w-full"
                    />
                  </div>

                  {/* Preview and Apply */}
                  <div className="pt-2 border-t border-dark-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-400">Calculated:</span>
                      <span className="text-sm font-mono font-bold text-cyan-400">{getCalculatedRho()} kg/m³</span>
                    </div>
                    <button
                      onClick={applyCalculatedRho}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded text-xs font-medium transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {(data || (method === 'climb' && (data || data2))) && (
          <>
            {/* Solver */}
            <div className="card">
              <h3 className="label-sm mb-3">Solver</h3>

              {/* Chung Method */}
              {method === 'chung' && (
                <>
                  <div className="mb-3">
                    <label className="text-[10px] text-gray-500 mb-1 block">Max Iterations</label>
                    <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark w-full" />
                  </div>

                  <button onClick={runGlobal} disabled={busy} className="btn-primary w-full">
                    {busy ? 'Optimizing...' : 'Auto-Fit'}
                  </button>
                </>
              )}

              {/* Shen Method - Dual File */}
              {method === 'shen' && (
                <>
                  <div className="mb-3">
                    <label className="text-[10px] text-gray-500 mb-1 block">Max Iterations</label>
                    <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark w-full" />
                  </div>

                  {/* Files Status */}
                  <div className={`p-2 rounded text-[10px] border mb-3 ${
                    data && data2
                      ? 'bg-green-900/20 border-green-500/30 text-green-400'
                      : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'
                  }`}>
                    <div className="font-medium mb-1">
                      {data && data2 ? 'Both files loaded' : 'Load both files to run solver'}
                    </div>
                    <div className="text-gray-400 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className={data ? 'text-amber-400' : 'text-gray-500'}>{data ? '✓' : '○'}</span>
                        <span>Slow Accel: {fileName || 'Not loaded'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={data2 ? 'text-orange-400' : 'text-gray-500'}>{data2 ? '✓' : '○'}</span>
                        <span>Fast Accel: {fileName2 || 'Not loaded'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={runShen}
                    disabled={busy || !data || !data2}
                    className={`w-full py-2 rounded font-medium text-xs transition-colors ${
                      data && data2
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {busy ? 'Analyzing...' : 'Run Shen Method'}
                  </button>

                  {/* Current Metrics Display (for each file) */}
                  {data && sim && (
                    <div className="bg-dark-input p-3 rounded text-[10px] border border-dark-border mt-3">
                      <div className="font-medium text-amber-400 mb-2">Current Metrics</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Bow (Slow)</span>
                          <span className={`font-mono font-bold ${Math.abs(currentBow || 0) < 0.5 ? 'text-green-400' : Math.abs(currentBow || 0) < 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {(currentBow || 0) > 0 ? '+' : ''}{(currentBow || 0).toFixed(2)}m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Net (Slow)</span>
                          <span className={`font-mono font-bold ${Math.abs(sim.netElev || 0) < 1 ? 'text-green-400' : Math.abs(sim.netElev || 0) < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {(sim.netElev || 0) > 0 ? '+' : ''}{(sim.netElev || 0).toFixed(2)}m
                          </span>
                        </div>
                        {data2 && sim2 && (
                          <>
                            <div className="border-t border-dark-border my-1.5" />
                            <div className="flex justify-between">
                              <span className="text-gray-400">Bow (Fast)</span>
                              <span className={`font-mono font-bold ${Math.abs(currentBow2 || 0) < 0.5 ? 'text-green-400' : Math.abs(currentBow2 || 0) < 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {(currentBow2 || 0) > 0 ? '+' : ''}{(currentBow2 || 0).toFixed(2)}m
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Net (Fast)</span>
                              <span className={`font-mono font-bold ${Math.abs(sim2.netElev || 0) < 1 ? 'text-green-400' : Math.abs(sim2.netElev || 0) < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {(sim2.netElev || 0) > 0 ? '+' : ''}{(sim2.netElev || 0).toFixed(2)}m
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <p className="text-gray-500 mt-2 text-[9px]">
                        Goal: Bow ≈ 0 (straight) & Net ≈ 0 (level)
                      </p>
                    </div>
                  )}

                  {/* Shen Result */}
                  {shenResult && (
                    <div className="bg-amber-900/20 p-3 rounded text-[10px] border border-amber-500/30 mt-3">
                      <div className="font-medium text-amber-400 mb-2">Shen Method Result</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Bow (Slow)</span>
                          <span className={`font-mono ${Math.abs(shenResult.bow1) < 0.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {shenResult.bow1 > 0 ? '+' : ''}{shenResult.bow1.toFixed(3)}m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Bow (Fast)</span>
                          <span className={`font-mono ${Math.abs(shenResult.bow2) < 0.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {shenResult.bow2 > 0 ? '+' : ''}{shenResult.bow2.toFixed(3)}m
                          </span>
                        </div>
                        <div className="border-t border-dark-border my-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-400">Net Elev (Slow)</span>
                          <span className={`font-mono ${Math.abs(shenResult.netElev1) < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {shenResult.netElev1 > 0 ? '+' : ''}{shenResult.netElev1.toFixed(2)}m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Net Elev (Fast)</span>
                          <span className={`font-mono ${Math.abs(shenResult.netElev2) < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {shenResult.netElev2 > 0 ? '+' : ''}{shenResult.netElev2.toFixed(2)}m
                          </span>
                        </div>
                        <div className="border-t border-dark-border my-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-400">Avg Speed (Slow)</span>
                          <span className="font-mono text-amber-400">{shenResult.avgSpeed1.toFixed(1)} km/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Avg Speed (Fast)</span>
                          <span className="font-mono text-orange-400">{shenResult.avgSpeed2.toFixed(1)} km/h</span>
                        </div>
                      </div>
                      <p className="text-gray-500 mt-2 text-[9px]">
                        Bow ≈ 0 (straight) & Net Elev ≈ 0 (level) = correct CdA/Crr
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Climb Method */}
              {method === 'climb' && (
                <>
                  <div className="mb-3">
                    <label className="text-[10px] text-gray-500 mb-1 block">Max Iterations</label>
                    <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark w-full" />
                  </div>

                  {/* Files Status */}
                  <div className={`p-2 rounded text-[10px] border mb-3 ${
                    data && data2
                      ? 'bg-green-900/20 border-green-500/30 text-green-400'
                      : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'
                  }`}>
                    <div className="font-medium mb-1">
                      {data && data2 ? 'Both files loaded' : 'Load both files to run solver'}
                    </div>
                    <div className="text-gray-400 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className={data ? 'text-cyan-400' : 'text-gray-500'}>{data ? '✓' : '○'}</span>
                        <span>Low Speed: {fileName || 'Not loaded'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={data2 ? 'text-yellow-400' : 'text-gray-500'}>{data2 ? '✓' : '○'}</span>
                        <span>High Speed: {fileName2 || 'Not loaded'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={runClimb}
                    disabled={busy || !data || !data2}
                    className={`w-full py-2 rounded font-medium text-xs transition-colors ${
                      data && data2
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {busy ? 'Analyzing...' : 'Run Climb Analysis'}
                  </button>

                  {/* Climb Result */}
                  {climbResult && (
                    <div className="bg-emerald-900/20 p-3 rounded text-[10px] border border-emerald-500/30 mt-3">
                      <div className="font-medium text-emerald-400 mb-2">Climb Method Result</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Combined RMSE</span>
                          <span className={`font-mono ${climbResult.rmse < 1 ? 'text-green-400' : climbResult.rmse < 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {climbResult.rmse.toFixed(3)}m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cyan-400">Low Speed RMSE</span>
                          <span className="font-mono text-cyan-400">{climbResult.rmse1.toFixed(3)}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-400">High Speed RMSE</span>
                          <span className="font-mono text-yellow-400">{climbResult.rmse2.toFixed(3)}m</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-dark-border mt-1">
                          <span className="text-gray-400">R²</span>
                          <span className={`font-mono ${climbResult.r2 > 0.95 ? 'text-green-400' : climbResult.r2 > 0.9 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {climbResult.r2.toFixed(4)}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-500 mt-2 text-[9px]">
                        Low: {climbResult.avgSpeed1.toFixed(1)} km/h | High: {climbResult.avgSpeed2.toFixed(1)} km/h
                      </p>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Fitted Values */}
            <div className="card">
              <h3 className="label-sm mb-3">Fitted Values</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-400 font-medium">CdA</span>
                    <span className="font-mono font-bold">{cda.toFixed(5)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.15"
                    max="0.5"
                    step="0.0001"
                    value={cda}
                    onChange={e => setCda(parseFloat(e.target.value))}
                    className="slider-cda"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-blue-400 font-medium">Crr</span>
                    <span className="font-mono font-bold">{crr.toFixed(5)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.002"
                    max="0.02"
                    step="0.0001"
                    value={crr}
                    onChange={e => setCrr(parseFloat(e.target.value))}
                    className="slider-crr"
                  />
                </div>
              </div>
            </div>

            {/* Experimental Features */}
            <div className="card border-yellow-500/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase font-medium">Beta</span>
                <h3 className="label-sm">Experimental</h3>
              </div>

              {/* Environment */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400">Wind Correction</span>
                  <button onClick={getWeather} disabled={fetchingW} className="btn-secondary text-[10px] py-0.5 px-2">
                    {fetchingW ? '...' : 'Fetch'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Speed (m/s)</label>
                    <input type="number" step="0.1" value={wSpd} onChange={e => setWSpd(safeNum(e.target.value, wSpd))} className="input-dark w-full" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Dir (°)</label>
                    <input type="number" step="1" value={wDir} onChange={e => setWDir(safeNum(e.target.value, wDir))} className="input-dark w-full" />
                  </div>
                </div>
                {method === 'chung' ? (
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-orange-400">Time Lag</span>
                      <span className="text-gray-400">{offset}s</span>
                    </div>
                    <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className="slider-lag" />
                  </div>
                ) : method === 'shen' ? (
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-amber-400">Slow Accel Lag</span>
                        <span className="text-gray-400">{offset}s</span>
                      </div>
                      <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className="w-full accent-amber-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-orange-400">Fast Accel Lag</span>
                        <span className="text-gray-400">{offset2}s</span>
                      </div>
                      <input type="range" min="-5" max="5" step="0.5" value={offset2} onChange={e => setOffset2(parseFloat(e.target.value))} className="w-full accent-orange-500" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-cyan-400">Low Speed Lag</span>
                        <span className="text-gray-400">{offset}s</span>
                      </div>
                      <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-yellow-400">High Speed Lag</span>
                        <span className="text-gray-400">{offset2}s</span>
                      </div>
                      <input type="range" min="-5" max="5" step="0.5" value={offset2} onChange={e => setOffset2(parseFloat(e.target.value))} className="w-full accent-yellow-500" />
                    </div>
                  </div>
                )}
              </div>

              {/* Low-pass Filter */}
              <div className="pt-3 border-t border-dark-border">
                <span className="text-xs text-gray-400 mb-2 block">Low-pass Filter</span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">GPS Elevation</span>
                    <button
                      onClick={() => setFilterGps(!filterGps)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${filterGps ? 'bg-emerald-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${filterGps ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Virtual Elevation</span>
                    <button
                      onClick={() => setFilterVirtual(!filterVirtual)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${filterVirtual ? 'bg-emerald-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${filterVirtual ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className={`transition-opacity ${(filterGps || filterVirtual) ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-500">Intensity</span>
                      <span className="text-white font-mono">{filterIntensity}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={filterIntensity}
                      onChange={e => setFilterIntensity(parseInt(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            {((method === 'chung' && sim && sim.r2 > 0) || (method === 'climb' && climbResult) || (method === 'shen' && shenResult)) && (
              <div className={`card bg-gradient-to-r ${
                method === 'climb' ? 'from-emerald-900/30' :
                method === 'shen' ? 'from-amber-900/30' : 'from-indigo-900/30'
              } to-dark-card ${
                method === 'climb' ? 'border-emerald-500/30' :
                method === 'shen' ? 'border-amber-500/30' : 'border-indigo-500/30'
              }`}>
                <h3 className="text-xs text-gray-400 uppercase mb-2">
                  {method === 'climb' ? 'Climb Results' : method === 'shen' ? 'Shen Results' : 'Results'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-gray-500">CdA</span>
                    <div className="text-lg font-mono font-bold text-green-400">{cda.toFixed(4)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">Crr</span>
                    <div className="text-lg font-mono font-bold text-blue-400">{crr.toFixed(5)}</div>
                  </div>
                </div>
                {method === 'climb' && climbResult && (
                  <div className="mt-2 pt-2 border-t border-dark-border text-[10px]">
                    <div className="flex justify-between text-gray-400">
                      <span>Low: {climbResult.avgSpeed1.toFixed(1)} km/h</span>
                      <span>High: {climbResult.avgSpeed2.toFixed(1)} km/h</span>
                    </div>
                  </div>
                )}
                {method === 'shen' && shenResult && (
                  <div className="mt-2 pt-2 border-t border-dark-border text-[10px]">
                    <div className="flex justify-between text-gray-400">
                      <span>Slow: {shenResult.avgSpeed1.toFixed(1)} km/h</span>
                      <span>Fast: {shenResult.avgSpeed2.toFixed(1)} km/h</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setShowSavePreset(true)}
                  className="w-full mt-3 py-2 text-xs font-medium text-gray-300 hover:text-white border border-dark-border hover:border-brand-primary/50 rounded-lg transition-all hover:bg-brand-primary/10 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save as Preset
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Chart Area */}
      <div className="flex-1 flex flex-col">
        {/* Chart Controls */}
        {(data || ((method === 'climb' || method === 'shen') && data2)) && (
          <div className="px-6 py-2 border-b border-dark-border bg-dark-card/50">
            {method === 'chung' ? (
              /* Single file mode controls (Chung only) */
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Range:</span>
                  <span className="text-xs font-mono text-brand-accent">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
                  <button
                    onClick={() => setRange([0, 100])}
                    className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    title="Reset to full range"
                  >
                    Reset
                  </button>
                </div>
                {(filterGps || filterVirtual) && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-500/30">
                    Filtered
                  </span>
                )}

                {/* Prominent RMSE & R² Display */}
                {sim && !sim.emptyRange && (
                  <div className="flex items-center gap-4 ml-auto">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">RMSE</span>
                      <span className={`text-lg font-mono font-bold ${sim.rmse < 1 ? 'text-emerald-400' : sim.rmse < 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {sim.rmse.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">R²</span>
                      <span className={`text-lg font-mono font-bold ${sim.r2 > 0.95 ? 'text-emerald-400' : sim.r2 > 0.9 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {sim.r2.toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : method === 'shen' ? (
              /* Shen mode controls - dual file (slow/fast acceleration) */
              <div className="space-y-2">
                {/* Slow accel file controls */}
                {data && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider w-24">Slow Accel</span>
                    <span className="text-[10px] font-mono text-amber-400">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
                    {sim && !sim.emptyRange && (
                      <span className="text-[10px] text-amber-400 font-mono">Bow: {(currentBow || 0).toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange([0, 100])}
                      className="text-[10px] text-gray-500 hover:text-amber-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* Fast accel file controls */}
                {data2 && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider w-24">Fast Accel</span>
                    <span className="text-[10px] font-mono text-orange-400">{Math.round(distanceRange2[0])}m - {Math.round(distanceRange2[1])}m</span>
                    {sim2 && !sim2.emptyRange && (
                      <span className="text-[10px] text-orange-400 font-mono">Bow: {(currentBow2 || 0).toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange2([0, 100])}
                      className="text-[10px] text-gray-500 hover:text-orange-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* Shen result display */}
                {shenResult && (
                  <div className="flex items-center gap-4 pt-1 border-t border-dark-border mt-2 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">Bow (Slow)</span>
                      <span className={`text-sm font-mono font-bold ${Math.abs(shenResult.bow1) < 0.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {shenResult.bow1.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">Bow (Fast)</span>
                      <span className={`text-sm font-mono font-bold ${Math.abs(shenResult.bow2) < 0.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {shenResult.bow2.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">Net (Slow)</span>
                      <span className={`text-sm font-mono font-bold ${Math.abs(shenResult.netElev1) < 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {shenResult.netElev1.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">Net (Fast)</span>
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
                    <span className="text-[10px] font-mono text-cyan-400">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
                    {sim && !sim.emptyRange && (
                      <span className="text-[10px] text-cyan-400 font-mono">RMSE: {sim.rmse.toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange([0, 100])}
                      className="text-[10px] text-gray-500 hover:text-cyan-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* High speed file controls */}
                {data2 && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider w-24">High Speed</span>
                    <span className="text-[10px] font-mono text-yellow-400">{Math.round(distanceRange2[0])}m - {Math.round(distanceRange2[1])}m</span>
                    {sim2 && !sim2.emptyRange && (
                      <span className="text-[10px] text-yellow-400 font-mono">RMSE: {sim2.rmse.toFixed(2)}m</span>
                    )}
                    <button
                      onClick={() => setRange2([0, 100])}
                      className="text-[10px] text-gray-500 hover:text-yellow-400 px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* Combined RMSE display */}
                {climbResult && (
                  <div className="flex items-center gap-4 pt-1 border-t border-dark-border mt-2">
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">Combined RMSE</span>
                      <span className={`text-sm font-mono font-bold ${climbResult.rmse < 1 ? 'text-emerald-400' : climbResult.rmse < 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {climbResult.rmse.toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-dark-bg border border-dark-border">
                      <span className="text-[10px] text-gray-500 uppercase">R²</span>
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
