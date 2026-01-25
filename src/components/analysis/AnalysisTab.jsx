import { useState, useMemo, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { parseGPX } from '../../lib/gpxParser'
import { solveCdaCrr, safeNum, GRAVITY } from '../../lib/physics'
import { useAnalyses } from '../../hooks/useAnalyses'
import { AlertDialog } from '../ui'

// Session storage key for persisting analysis state
const SESSION_KEY = 'aerobench_analysis_session'

export const AnalysisTab = ({ physics, selectedSetup, onUpdateSetup }) => {
  const { mass, eff, rho } = physics
  const { createAnalysis } = useAnalyses(selectedSetup?.id)

  // Local CdA/Crr state for fitting (initialized from setup, modified during solve)
  // Use 0.32/0.004 as solver starting points if setup has no values
  const [cda, setCda] = useState(selectedSetup?.cda ?? 0.32)
  const [crr, setCrr] = useState(selectedSetup?.crr ?? 0.004)

  // Reset local values when setup changes
  useEffect(() => {
    if (selectedSetup) {
      setCda(selectedSetup.cda ?? 0.32)
      setCrr(selectedSetup.crr ?? 0.004)
    }
  }, [selectedSetup?.id])

  const [data, setData] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [fileName, setFileName] = useState(null)

  // Environment
  const [wSpd, setWSpd] = useState(0)
  const [wDir, setWDir] = useState(0)
  const [offset, setOffset] = useState(0)
  const [range, setRange] = useState([0, 100])

  // Solver
  const [busy, setBusy] = useState(false)
  const [fetchingW, setFetchingW] = useState(false)
  const [maxIterations, setMaxIterations] = useState(500)
  const [saved, setSaved] = useState(false)

  // Display options
  const [smoothFilter, setSmoothFilter] = useState(false)
  const [smoothAmount, setSmoothAmount] = useState(3) // 1-10 scale

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })

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
        if (session.setupId === selectedSetup?.id) {
          if (session.data) setData(session.data)
          if (session.fileName) setFileName(session.fileName)
          if (session.startTime) setStartTime(new Date(session.startTime))
          if (session.cda != null) setCda(session.cda)
          if (session.crr != null) setCrr(session.crr)
          if (session.wSpd != null) setWSpd(session.wSpd)
          if (session.wDir != null) setWDir(session.wDir)
          if (session.offset != null) setOffset(session.offset)
          if (session.range) setRange(session.range)
          if (session.maxIterations != null) setMaxIterations(session.maxIterations)
        }
      }
    } catch (e) {
      console.warn('Failed to restore analysis session:', e)
    }
  }, [])

  // Save session to sessionStorage when key values change
  const saveSession = useCallback(() => {
    if (!data) return
    try {
      const session = {
        setupId: selectedSetup?.id,
        data,
        fileName,
        startTime: startTime?.toISOString(),
        cda,
        crr,
        wSpd,
        wDir,
        offset,
        range,
        maxIterations
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch (e) {
      console.warn('Failed to save analysis session:', e)
    }
  }, [data, fileName, startTime, cda, crr, wSpd, wDir, offset, range, maxIterations, selectedSetup?.id])

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

  // File Handler
  const onFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    setSaved(false)
    const r = new FileReader()
    r.onload = (ev) => {
      const result = parseGPX(ev.target.result)
      setData(result.data)
      setStartTime(result.startTime)
    }
    r.readAsText(f)
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

  // Reset analysis (keeps GPX file)
  const resetAnalysis = () => {
    setCda(selectedSetup?.cda ?? 0.32)
    setCrr(selectedSetup?.crr ?? 0.004)
    setWSpd(0)
    setWDir(0)
    setOffset(0)
    setRange([0, 100])
    setMaxIterations(500)
    setSmoothFilter(false)
    setSmoothAmount(3)
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
    vEle[0] = ele[0]
    let cur = ele[0]

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
      err[i] = cur - ele[i]
    }

    // Calculate RMSE and R² only within the selected range
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

    return { vEle, err, sIdx, eIdx, rmse, r2 }
  }, [data, cda, crr, mass, eff, rho, offset, wSpd, wDir, range])

  // Solvers
  const runGlobal = () => {
    if (!data) return
    setBusy(true)
    setTimeout(() => {
      const res = solveCdaCrr(data, sim.sIdx, sim.eIdx, cda, crr, mass, eff, rho, offset, wSpd, wDir, { method: 'chung', maxIterations })
      setCda(res.cda)
      setCrr(res.crr)
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

  // Calculate distance range from percentage range
  const distanceRange = useMemo(() => {
    if (!data) return [0, 0]
    const maxDist = data.dist[data.dist.length - 1]
    return [
      (range[0] / 100) * maxDist,
      (range[1] / 100) * maxDist
    ]
  }, [data, range])

  // Handle rangeslider changes
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
    font: { color: '#94a3b8' },
    margin: { t: 40, l: 50, r: 20, b: 40 },
    grid: { rows: 3, columns: 1, pattern: 'independent' },
    showlegend: true,
    legend: { orientation: 'h', y: 1.1, x: 0 },
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

  return (
    <div className="flex h-full">
      {/* Sidebar Controls */}
      <div className="w-72 flex-shrink-0 border-r border-dark-border overflow-y-auto p-4 space-y-4">
        {/* Current Setup Info */}
        <div className="card bg-gradient-to-r from-indigo-900/30 to-dark-card border-indigo-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Analyzing</span>
            {hasChanges && (
              <span className="text-[10px] text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">Modified</span>
            )}
          </div>
          <h3 className="font-bold text-white">{selectedSetup?.name}</h3>
          {selectedSetup?.bike_name && (
            <p className="text-xs text-gray-500">{selectedSetup.bike_name}</p>
          )}
        </div>

        {/* File Upload */}
        <div className="card">
          <label className="block w-full cursor-pointer bg-brand-primary hover:bg-indigo-600 text-white text-center py-2 rounded font-medium transition-colors">
            Upload GPX File
            <input type="file" accept=".gpx" onChange={onFile} className="hidden" />
          </label>
          {!data && <p className="text-center text-xs text-gray-500 mt-2">No file loaded</p>}
          {data && fileName && (
            <div className="mt-2">
              <p className="text-center text-xs text-gray-400 truncate">{fileName}</p>
              <button onClick={resetAnalysis} className="w-full mt-2 text-xs text-gray-400 hover:text-white border border-dark-border rounded py-1 hover:bg-dark-input transition-colors">
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
                <label className="text-[10px] text-gray-500 mb-1 block">Max Iterations</label>
                <div className="flex gap-2">
                  <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark flex-1" />
                  <button onClick={() => setMaxIterations(500)} className="px-2 text-xs text-gray-400 hover:text-white border border-dark-border rounded hover:bg-dark-input transition-colors" title="Reset to default (500)">↺</button>
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
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Wind (m/s)</label>
                  <input type="number" step="0.1" value={wSpd} onChange={e => setWSpd(safeNum(e.target.value, wSpd))} className="input-dark w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Direction</label>
                  <input type="number" step="1" value={wDir} onChange={e => setWDir(safeNum(e.target.value, wDir))} className="input-dark w-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-orange-400 font-medium">Time Lag</span>
                  <span>{offset}s</span>
                </div>
                <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className="slider-lag" />
              </div>
            </div>

            {sim && (
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
            )}

            {/* Save Button */}
            <button
              onClick={saveToSetup}
              disabled={saved || !hasChanges}
              className={`w-full py-2 rounded font-medium text-sm transition-all ${
                saved
                  ? 'bg-green-600 text-white'
                  : hasChanges
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
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
              <span className="text-xs font-mono text-brand-accent">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
              <button
                onClick={() => setRange([0, 100])}
                className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded border border-dark-border hover:bg-dark-input"
                title="Reset to full range"
              >
                Reset
              </button>
            </div>
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
                <div className="text-5xl">⚠️</div>
                <p className="text-lg">Range too narrow</p>
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
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-4">
              <div className="text-6xl opacity-20">📊</div>
              <p>Upload a GPX file to begin analysis</p>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert Dialog */}
      <AlertDialog
        isOpen={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, message: '' })}
        title="Error Saving"
        message={errorDialog.message}
        variant="error"
      />
    </div>
  )
}
