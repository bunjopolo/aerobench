import { useState, useMemo, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { parseActivityFile } from '../../lib/gpxParser'
import { solveCdaCrr, safeNum, GRAVITY, computeResidualMetrics, computeSegmentStats } from '../../lib/physics'
import { fetchRideWeatherSnapshot } from '../../lib/weather'
import { useAnalyses } from '../../hooks/useAnalyses'
import { AlertDialog, MetricInfoButton } from '../ui'

// Session storage key for persisting analysis state
const SESSION_KEY = 'aerobench_analysis_session'

export const AnalysisTab = ({ physics, selectedSetup, onUpdateSetup }) => {
  const { mass, eff, rho } = physics
  const { createAnalysis } = useAnalyses(selectedSetup?.id)
  const selectedSetupId = selectedSetup?.id ?? null
  const selectedSetupCda = selectedSetup?.cda ?? 0.32
  const selectedSetupCrr = selectedSetup?.crr ?? 0.004

  // Local CdA/Crr state for fitting (initialized from setup, modified during solve)
  // Use 0.32/0.004 as solver starting points if setup has no values
  const [cda, setCda] = useState(selectedSetupCda)
  const [crr, setCrr] = useState(selectedSetupCrr)

  // Reset local values when setup changes
  useEffect(() => {
    if (selectedSetupId) {
      setCda(selectedSetupCda)
      setCrr(selectedSetupCrr)
    }
  }, [selectedSetupId, selectedSetupCda, selectedSetupCrr])

  const [data, setData] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [hasPowerData, setHasPowerData] = useState(true)
  const [lapMarkers, setLapMarkers] = useState([])
  const [speedSource, setSpeedSource] = useState('wheel')

  // Environment
  const [wSpd, setWSpd] = useState(0)
  const [wDir, setWDir] = useState(0)
  const [powerOffset, setPowerOffset] = useState(0)
  const offset = powerOffset
  const [range, setRange] = useState([0, 100])

  // Solver
  const [busy, setBusy] = useState(false)
  const [fetchingW, setFetchingW] = useState(false)
  const [weatherError, setWeatherError] = useState(null)
  const [weatherFetchInfo, setWeatherFetchInfo] = useState(null)
  const [maxIterations, setMaxIterations] = useState(500)
  const [saved, setSaved] = useState(false)

  // Display options
  const [smoothFilter, setSmoothFilter] = useState(false)
  const [smoothAmount, setSmoothAmount] = useState(3) // 1-10 scale

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })
  const diagnosticInfoItems = [
    { label: 'RMSE', description: 'Root mean square residual error in meters; lower is better.' },
    { label: 'R²', description: 'How much elevation variance is explained by VE; closer to 1 is better.' },
    { label: 'MAE', description: 'Mean absolute residual in meters; less sensitive to outliers than RMSE.' },
    { label: 'Bias', description: 'Average signed residual in meters; positive means VE tends to sit above GPS.' },
    { label: 'Drift', description: 'Residual change from start to end of range in meters; near zero is preferred.' },
    { label: 'NRMSE', description: 'RMSE normalized by elevation range; lower % indicates better relative fit.' },
    { label: 'Trend', description: 'Residual slope versus distance (m per km); near zero means less systematic drift.' },
    { label: 'Lag-1 AC', description: 'Residual autocorrelation at one-sample lag; high values indicate structured error.' },
    { label: 'Speed span', description: 'Speed range in the selected segment; larger span usually improves identifiability.' },
    { label: 'Grade var', description: 'Variance of segment grade; helps indicate how informative the terrain is.' }
  ]

  const wheelSpeedAvailable = Boolean(
    data?.hasWheelSpeed &&
    Array.isArray(data?.vWheel) &&
    Array.isArray(data?.aWheel)
  )

  const dataForSolve = useMemo(() => {
    if (!data) return null
    if (speedSource === 'wheel' && wheelSpeedAvailable) {
      return { ...data, v: data.vWheel, a: data.aWheel }
    }
    return { ...data, v: data.vGps || data.v, a: data.aGps || data.a }
  }, [data, speedSource, wheelSpeedAvailable])

  useEffect(() => {
    if (speedSource === 'wheel' && data && !wheelSpeedAvailable) {
      setSpeedSource('gps')
    }
  }, [speedSource, wheelSpeedAvailable, data])

  // Variable smoothing function - applies moving average with adjustable window
  const smoothData = (arr, level) => {
    if (level <= 1 || arr.length < 5) return arr
    const windowSize = Math.min(Math.floor(level * 4) + 1, 41) // 5 to 41 points
    const halfWindow = Math.floor(windowSize / 2)
    return arr.map((_, i) => {
      const start = Math.max(0, i - halfWindow)
      const end = Math.min(arr.length, i + halfWindow + 1)
      let sum = 0
      for (let j = start; j < end; j++) sum += arr[j]
      return sum / (end - start)
    })
  }

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const session = JSON.parse(saved)
        // Only restore if it's for the same setup
        if (session.setupId === selectedSetupId) {
          if (session.data) setData(session.data)
          if (session.fileName) setFileName(session.fileName)
          if (session.startTime) setStartTime(new Date(session.startTime))
          if (session.hasPowerData != null) setHasPowerData(session.hasPowerData)
          if (session.lapMarkers) setLapMarkers(session.lapMarkers)
          if (session.cda != null) setCda(session.cda)
          if (session.crr != null) setCrr(session.crr)
          if (session.wSpd != null) setWSpd(session.wSpd)
          if (session.wDir != null) setWDir(session.wDir)
          if (session.powerOffset != null) setPowerOffset(session.powerOffset)
          if (session.range) setRange(session.range)
          if (session.maxIterations != null) setMaxIterations(session.maxIterations)
          if (session.speedSource === 'gps' || session.speedSource === 'wheel') setSpeedSource(session.speedSource)
        }
      }
    } catch (e) {
      console.warn('Failed to restore analysis session:', e)
    }
  }, [selectedSetupId])

  // Save session to sessionStorage when key values change
  const saveSession = useCallback(() => {
    if (!data) return
    try {
      const session = {
        setupId: selectedSetupId,
        data,
        fileName,
        startTime: startTime?.toISOString(),
        hasPowerData,
        lapMarkers,
        cda,
        crr,
        wSpd,
        wDir,
        powerOffset,
        speedSource,
        range,
        maxIterations
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch (e) {
      console.warn('Failed to save analysis session:', e)
    }
  }, [data, fileName, startTime, hasPowerData, lapMarkers, cda, crr, wSpd, wDir, powerOffset, speedSource, range, maxIterations, selectedSetupId])

  useEffect(() => {
    saveSession()
  }, [saveSession])


  // Track if values have been modified from setup (or if setup has no values yet)
  const hasChanges = selectedSetup && (
    selectedSetup.cda == null ||
    selectedSetup.crr == null ||
    Math.abs(cda - (selectedSetup.cda ?? 0)) > 0.00001 ||
    Math.abs(crr - (selectedSetup.crr ?? 0)) > 0.000001
  )

  // File Handler (FIT only)
  const onFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    setSaved(false)
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

  // Save analysis and update setup
  const saveToSetup = async () => {
    if (!selectedSetup) return
    try {
      // Create analysis record
      await createAnalysis({
        setup_id: selectedSetup.id,
        name: fileName || 'Analysis',
        fitted_cda: cda,
        fitted_crr: crr,
        rmse: sim?.rmse || null,
        r2: sim?.r2 || null,
        wind_speed: wSpd,
        wind_direction: wDir,
        ride_date: startTime ? startTime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: `RMSE: ${sim?.rmse?.toFixed(3) || 'N/A'}m, R²: ${sim?.r2?.toFixed(4) || 'N/A'}`
      })

      // Update setup with latest values
      await onUpdateSetup(selectedSetup.id, { cda, crr })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setErrorDialog({ open: true, message: err.message })
    }
  }

  // Reset analysis (keeps loaded file)
  const resetAnalysis = () => {
    setCda(selectedSetup?.cda ?? 0.32)
    setCrr(selectedSetup?.crr ?? 0.004)
    setWSpd(0)
    setWDir(0)
    setPowerOffset(0)
    setRange([0, 100])
    setMaxIterations(500)
    setSmoothFilter(false)
    setSmoothAmount(3)
    setHasPowerData(true)
    setLapMarkers([])
    setSpeedSource('wheel')
    setWeatherFetchInfo(null)
  }

  // Simulation calculation - compute virtual elevation for SELECTED RANGE ONLY
  // Starts fresh at ele[sIdx], treats cropped region as standalone segment
  const sim = useMemo(() => {
    if (!dataForSolve) return null
    const { pwr, v, a, ds, ele, b } = dataForSolve
    const sIdx = Math.floor((range[0] / 100) * pwr.length)
    const eIdx = Math.floor((range[1] / 100) * pwr.length)

    if (sIdx >= eIdx || eIdx - sIdx < 2) {
      return { vEle: [], err: [], sIdx, eIdx, rmse: 0, anomalies: [], emptyRange: true }
    }

    // Arrays for the selected range only (same length as full data for chart compatibility)
    // Values outside selected range are set to the boundary values for smooth display
    const vEle = new Array(pwr.length)
    const err = new Array(pwr.length)

    // Start fresh at GPS elevation of range start
    let cur = ele[sIdx]

    const iOff = Math.round(offset)
    const wRad = wDir * (Math.PI / 180)

    // Compute virtual elevation for selected range
    for (let i = sIdx; i < eIdx; i++) {
      if (i > sIdx) {
        const vg = Math.max(1.0, v[i])
        let pi = i - iOff
        if (pi < 0) pi = 0
        if (pi >= pwr.length) pi = pwr.length - 1

        const pw = pwr[pi] * eff
        const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wRad)

        const fa = 0.5 * rho * cda * va * va * Math.sign(va)
        const ft = pw / vg
        const fr = mass * GRAVITY * crr
        const fac = mass * a[i]

        cur += ((ft - fr - fac - fa) / (mass * GRAVITY)) * ds[i]
      }
      vEle[i] = cur
      err[i] = cur - ele[i]
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
    const diagnostics = computeResidualMetrics(err, ele, sIdx, eIdx, dataForSolve?.dist)
    const observability = computeSegmentStats(dataForSolve, sIdx, eIdx)

    return { vEle, err, sIdx, eIdx, rmse, r2, diagnostics, observability }
  }, [dataForSolve, cda, crr, mass, eff, rho, offset, wSpd, wDir, range])

  // Solvers
  const runGlobal = () => {
    if (!dataForSolve || !sim) return
    setBusy(true)
    setTimeout(() => {
      const res = solveCdaCrr(dataForSolve, sim.sIdx, sim.eIdx, cda, crr, mass, eff, rho, offset, wSpd, wDir, { method: 'chung', maxIterations })
      setCda(res.cda)
      setCrr(res.crr)
      setBusy(false)
    }, 50)
  }

  const getWeather = async () => {
    if (!data || !startTime) return
    setFetchingW(true)
    setWeatherError(null)
    setWeatherFetchInfo(null)
    try {
      const len = Array.isArray(data.dist) ? data.dist.length : 0
      const sIdx = len > 0 ? Math.max(0, Math.min(len - 1, Math.floor((range[0] / 100) * len))) : 0
      const selectedStartTime = Array.isArray(data.t) && Number.isFinite(data.t[sIdx])
        ? new Date(startTime.getTime() + data.t[sIdx] * 1000)
        : startTime

      const wx = await fetchRideWeatherSnapshot({ data, startTime: selectedStartTime, sampleIndex: sIdx })
      setWeatherFetchInfo({
        timeIso: selectedStartTime.toISOString(),
        latitude: wx.latitude,
        longitude: wx.longitude
      })
      if (Number.isFinite(wx.windSpeedRiderMs)) {
        setWSpd(wx.windSpeedRiderMs)
        if (Number.isFinite(wx.windDirectionDeg)) setWDir(wx.windDirectionDeg)
      } else {
        setWeatherError('No wind data for this time')
      }
    } catch (e) {
      console.error(e)
      setWeatherError(e?.message || 'Failed to fetch weather')
    } finally {
      setFetchingW(false)
    }
  }

  // Calculate distance ranges from percentage ranges
  // IMPORTANT: Use actual distances at the index boundaries to match vEle computation
  const distanceRange = useMemo(() => {
    if (!data) return [0, 0]
    const sIdx = Math.floor((range[0] / 100) * data.dist.length)
    const eIdx = Math.min(Math.floor((range[1] / 100) * data.dist.length), data.dist.length - 1)
    return [data.dist[sIdx] || 0, data.dist[eIdx] || 0]
  }, [data, range])

  const rangeStep = useMemo(() => {
    const len = data?.dist?.length || 0
    return len > 0 ? (100 / len) : 1
  }, [data])

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

  const distanceToRangePct = useCallback((targetDist) => {
    if (!data || !data.dist || data.dist.length === 0) return 0
    const idx = findDistanceIndex(targetDist)
    return (idx / data.dist.length) * 100
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
    const startPct = distanceToRangePct(startDist)
    const endPct = distanceToRangePct(endDist)
    const [nextStart, nextEnd] = normalizeRangePct(startPct, endPct)

    setRange((prev) => {
      if (Math.abs(prev[0] - nextStart) < 1e-6 && Math.abs(prev[1] - nextEnd) < 1e-6) {
        return prev
      }
      return [nextStart, nextEnd]
    })
  }, [data, distanceToRangePct, normalizeRangePct])

  // Handle rangeslider changes
  const handleRelayout = useCallback((eventData) => {
    if (!data) return

    if (eventData['xaxis.autorange']) {
      setRange([0, 100])
      return
    }

    let newStart
    let newEnd

    if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
      newStart = eventData['xaxis.range[0]']
      newEnd = eventData['xaxis.range[1]']
    } else if (eventData['xaxis.range']) {
      const rangeValues = eventData['xaxis.range']
      newStart = rangeValues[0]
      newEnd = rangeValues[1]
    }

    if (newStart === undefined || newEnd === undefined) return
    applyDistanceCrop(newStart, newEnd)
  }, [data, applyDistanceCrop])

  // Chart layout with rangeslider and lap markers
  const layout = useMemo(() => {
    const lapShapes = lapMarkers.map(lap => ({
      type: 'line',
      x0: lap.distance,
      x1: lap.distance,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: 'rgba(251, 191, 36, 0.6)', width: 2, dash: 'dot' }
    }))

    const lapAnnotations = lapMarkers.map(lap => ({
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
    }))

    return {
      autosize: true,
      paper_bgcolor: '#0f172a',
      plot_bgcolor: '#0f172a',
      font: { color: '#94a3b8' },
      margin: { t: 40, l: 50, r: 20, b: 40 },
      grid: { rows: 3, columns: 1, pattern: 'independent' },
      showlegend: true,
      legend: { orientation: 'h', y: 1.1, x: 0 },
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
      shapes: lapShapes,
      annotations: lapAnnotations
    }
  }, [distanceRange, lapMarkers])

  return (
    <div className="flex h-full">
      {/* Sidebar Controls */}
      <div className="w-72 flex-shrink-0 border-r border-dark-border overflow-y-auto p-4 space-y-4">
        {/* Current Setup Info */}
        <div className="card bg-gradient-to-r from-indigo-900/30 to-dark-card border-indigo-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Analyzing</span>
            {hasChanges && (
              <span className="text-xxs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">Modified</span>
            )}
          </div>
          <h3 className="font-bold text-white">{selectedSetup?.name}</h3>
          {selectedSetup?.bike_name && (
            <p className="text-xs text-gray-500">{selectedSetup.bike_name}</p>
          )}
        </div>

        {/* File Upload */}
        <div className="card">
          <label className="btn btn-primary btn-block cursor-pointer">
            Upload FIT File
            <input type="file" accept=".fit" onChange={onFile} className="hidden" />
          </label>
          {!data && <p className="text-center text-xs text-gray-500 mt-2">No file loaded</p>}
          {data && fileName && (
            <div className="mt-2">
              <p className="text-center text-xs text-gray-400 truncate">{fileName}</p>
              {!hasPowerData && (
                <p className="text-center text-xs text-yellow-500 mt-1">
                  Warning: No power data detected
                </p>
              )}
              <button onClick={resetAnalysis} className="btn btn-neutral btn-sm btn-block mt-2">
                Reset Analysis
              </button>
            </div>
          )}
        </div>

        {data && (
          <>
            {/* Solver */}
            <div className="card">
              <h3 className="label-sm mb-3">Solver</h3>

              <div className="mb-3">
                <label className="text-xxs text-gray-500 mb-1 block">Speed Source</label>
                <div className="flex bg-dark-input p-0.5 rounded border border-dark-border">
                  <button
                    onClick={() => wheelSpeedAvailable && setSpeedSource('wheel')}
                    disabled={!wheelSpeedAvailable}
                    className={`px-2 py-1.5 rounded text-xs font-medium flex-1 ${speedSource === 'wheel' ? 'bg-cyan-600 text-white' : 'text-gray-400'} ${!wheelSpeedAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Speed Sensor
                  </button>
                  <button
                    onClick={() => setSpeedSource('gps')}
                    className={`px-2 py-1.5 rounded text-xs font-medium flex-1 ${speedSource === 'gps' ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                  >
                    GPS
                  </button>
                </div>
                <p className="text-xxs text-gray-500 mt-1">
                  {wheelSpeedAvailable
                    ? `Using ${speedSource === 'wheel' ? 'speed sensor' : 'GPS'} speed for solver and VE.`
                    : 'Speed sensor data not available in this file.'}
                </p>
                {speedSource === 'gps' && (
                  <p className="text-xxs text-yellow-400 mt-1">
                    Warning: GPS speed is less reliable and may reduce CdA/Crr accuracy.
                  </p>
                )}
              </div>

              <div className="mb-3">
                <label className="text-xxs text-gray-500 mb-1 block">Power Offset (samples)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="1"
                    value={powerOffset}
                    onChange={e => setPowerOffset(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500"
                  />
                  <input
                    type="number"
                    min="-20"
                    max="20"
                    step="1"
                    value={powerOffset}
                    onChange={e => setPowerOffset(Math.max(-20, Math.min(20, Math.round(safeNum(e.target.value, powerOffset)))))}
                    className="input-dark w-16 text-center"
                  />
                </div>
                <p className="text-xxs text-gray-500 mt-1">Positive values advance power; negative values delay power. Use this to correct lag from power meter data.</p>
              </div>

              <div className="mb-3">
                <label className="text-xxs text-gray-500 mb-1 block">Max Iterations</label>
                <div className="flex gap-2">
                  <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark flex-1" />
                  <button onClick={() => setMaxIterations(500)} className="btn btn-ghost btn-sm px-2" title="Reset to default (500)">↺</button>
                </div>
              </div>

              <button onClick={runGlobal} disabled={busy} className="btn-primary w-full">
                {busy ? 'Optimizing...' : 'Auto-Fit'}
              </button>
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

            {/* Environment */}
            <div className="card">
              <div className="flex justify-between items-center mb-3">
                <h3 className="label-sm">Environment</h3>
                <button onClick={getWeather} disabled={fetchingW} className="btn-secondary text-xs">
                  {fetchingW ? '...' : 'Fetch Wind'}
                </button>
              </div>
              <p className="text-xxs text-gray-500 mb-2">
                Weather source: Open-Meteo archive API.
              </p>
              {weatherFetchInfo && (
                <p className="text-xxs text-cyan-300 mb-2">
                  Fetched for {weatherFetchInfo.timeIso.replace('T', ' ').slice(0, 16)} UTC at {weatherFetchInfo.latitude.toFixed(5)}, {weatherFetchInfo.longitude.toFixed(5)}.
                </p>
              )}
              {weatherError && (
                <p className="text-xxs text-red-400 mb-2">{weatherError}</p>
              )}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">Wind (m/s)</label>
                  <input type="number" step="0.1" value={wSpd} onChange={e => setWSpd(safeNum(e.target.value, wSpd))} className="input-dark w-full" />
                </div>
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">Direction</label>
                  <input type="number" step="1" value={wDir} onChange={e => setWDir(safeNum(e.target.value, wDir))} className="input-dark w-full" />
                </div>
              </div>
            </div>

            {sim && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded bg-dark-bg border border-dark-border">
                    <span className="text-xs text-gray-500 uppercase">RMSE</span>
                    <div className={`text-xl font-mono font-bold ${sim.rmse < 1 ? 'text-emerald-400' : 'text-indigo-400'}`}>
                      {sim.rmse.toFixed(3)}m
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-dark-bg border border-dark-border">
                    <span className="text-xs text-gray-500 uppercase">R²</span>
                    <div className={`text-xl font-mono font-bold ${sim.r2 > 0.95 ? 'text-emerald-400' : sim.r2 > 0.9 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {sim.r2.toFixed(4)}
                    </div>
                  </div>
                </div>

                <details className="text-xs p-2 rounded bg-dark-bg border border-dark-border">
                  <summary className="cursor-pointer text-gray-300 font-medium">Diagnostics</summary>
                  <div className="flex items-center justify-end mt-1">
                    <MetricInfoButton title="Diagnostics Guide" items={diagnosticInfoItems} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                    <span className="text-gray-500">MAE</span><span className="font-mono text-gray-300 text-right">{sim.diagnostics.mae.toFixed(2)}m</span>
                    <span className="text-gray-500">Bias</span><span className="font-mono text-gray-300 text-right">{sim.diagnostics.bias.toFixed(2)}m</span>
                    <span className="text-gray-500">Drift</span><span className="font-mono text-gray-300 text-right">{sim.diagnostics.drift.toFixed(2)}m</span>
                    <span className="text-gray-500">NRMSE</span><span className="font-mono text-gray-300 text-right">{(sim.diagnostics.nrmse * 100).toFixed(1)}%</span>
                    <span className="text-gray-500">Trend</span><span className="font-mono text-gray-300 text-right">{sim.diagnostics.residualSlopeMPerKm.toFixed(2)} m/km</span>
                    <span className="text-gray-500">Lag-1 AC</span><span className="font-mono text-gray-300 text-right">{sim.diagnostics.residualLag1.toFixed(3)}</span>
                    <span className="text-gray-500">Speed span</span><span className="font-mono text-gray-300 text-right">{sim.observability.speedSpanKph.toFixed(1)} km/h</span>
                    <span className="text-gray-500">Grade var</span><span className="font-mono text-gray-300 text-right">{sim.observability.gradeVar.toFixed(2)}</span>
                  </div>
                </details>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={saveToSetup}
              disabled={saved || !hasChanges}
              className={`btn btn-block ${
                saved
                  ? 'btn-success'
                  : hasChanges
                    ? 'btn-warning'
                    : 'btn-neutral'
              }`}
            >
              {saved ? 'Saved!' : hasChanges ? 'Save to Setup' : 'No Changes'}
            </button>
          </>
        )}
      </div>

      {/* Chart Area */}
      <div className="flex-1 flex flex-col">
        {/* Chart Controls */}
        {data && (
          <div className="flex items-center gap-6 px-6 py-2 border-b border-dark-border bg-dark-card/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Range:</span>
              <div className="flex items-center">
                <button
                  onClick={() => setRange([Math.max(0, range[0] - rangeStep), range[1]])}
                  className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-l border border-dark-border hover:bg-dark-input"
                  title="Move start back"
                >◀</button>
                <button
                  onClick={() => setRange([Math.min(range[1] - rangeStep, range[0] + rangeStep), range[1]])}
                  className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-r border-t border-b border-r border-dark-border hover:bg-dark-input"
                  title="Move start forward"
                >▶</button>
              </div>
              <span className="text-xs font-mono text-brand-accent">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
              <div className="flex items-center">
                <button
                  onClick={() => setRange([range[0], Math.max(range[0] + rangeStep, range[1] - rangeStep)])}
                  className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-l border border-dark-border hover:bg-dark-input"
                  title="Move end back"
                >◀</button>
                <button
                  onClick={() => setRange([range[0], Math.min(100, range[1] + rangeStep)])}
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
            </div>
            {lapMarkers.length > 0 && data && (() => {
              const maxDist = data.dist[data.dist.length - 1]
              const currentStartDist = distanceRange[0]
              const currentEndDist = distanceRange[1]

              let currentStartLapIdx = -1
              for (let i = 0; i < lapMarkers.length; i++) {
                if (lapMarkers[i].distance <= currentStartDist + 1) {
                  currentStartLapIdx = i
                }
              }

              let currentEndLapIdx = -1
              for (let i = lapMarkers.length - 1; i >= 0; i--) {
                if (lapMarkers[i].distance >= currentEndDist - 1) {
                  currentEndLapIdx = i
                }
              }

              return (
                <div className="flex items-center gap-2 border-l border-dark-border pl-4">
                  <span className="text-xs text-amber-400">Lap Crop:</span>
                  <select
                    className="text-xxs bg-dark-input border border-dark-border rounded px-1.5 py-0.5 text-gray-300"
                    value={currentStartLapIdx}
                    onChange={(e) => {
                      const lapIdx = parseInt(e.target.value, 10)
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
                      const lapIdx = parseInt(e.target.value, 10)
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
                      idx > currentStartLapIdx && (
                        <option key={idx} value={idx}>{lap.name}</option>
                      )
                    ))}
                    <option value={-1}>End</option>
                  </select>
                </div>
              )
            })()}
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-xs text-gray-400">Smooth</span>
              <button
                onClick={() => setSmoothFilter(!smoothFilter)}
                className={`relative w-10 h-5 rounded-full transition-colors ${smoothFilter ? 'bg-indigo-600' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${smoothFilter ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              {smoothFilter && (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={smoothAmount}
                    onChange={e => setSmoothAmount(parseInt(e.target.value))}
                    className="w-20 accent-indigo-500"
                  />
                  <span className="text-xs font-mono text-indigo-400 w-4">{smoothAmount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1">
          {data ? (
            sim && sim.emptyRange ? (
              <div className="flex flex-col items-center justify-center h-full text-yellow-500 space-y-4">
                <svg className="w-16 h-16 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-lg mt-4">Range too narrow</p>
                <p className="text-sm text-gray-500">Adjust the crop sliders</p>
              </div>
            ) : (
              <Plot
                data={(() => {
                  // Use full data for rangeslider visibility
                  const displayEle = smoothFilter ? smoothData(data.ele, smoothAmount) : data.ele
                  const displayVEle = smoothFilter ? smoothData(sim.vEle, smoothAmount) : sim.vEle

                  return [
                    { x: data.dist, y: displayEle, type: 'scatter', mode: 'lines', name: 'GPS Elev', line: { color: '#ef4444', width: 2 }, opacity: 0.6 },
                    { x: data.dist, y: displayVEle, type: 'scatter', mode: 'lines', name: 'Virtual Elev', line: { color: '#06b6d4', width: 2 } },
                    { x: data.dist, y: sim.err, type: 'scatter', mode: 'lines', name: 'Residuals', line: { color: '#a855f7', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy' },
                    { x: data.dist, y: data.pwr, type: 'scatter', mode: 'lines', name: 'Power', line: { color: '#f97316', width: 1 }, xaxis: 'x', yaxis: 'y3', fill: 'tozeroy', opacity: 0.3 }
                  ]
                })()}
                layout={layout}
                onRelayout={handleRelayout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'] }}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-4">
              <svg className="w-16 h-16 mx-auto text-gray-600 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="mt-4">Upload a FIT file to begin analysis</p>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert Dialog */}
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
