import { useState, useMemo, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { parseGPX } from '../../lib/gpxParser'
import { solveCdaCrr, removeOutliers, safeNum } from '../../lib/physics'
import { useAnalyses } from '../../hooks/useAnalyses'

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
  const [mode, setMode] = useState('global')
  const [busy, setBusy] = useState(false)
  const [fetchingW, setFetchingW] = useState(false)
  const [segs, setSegs] = useState([])
  const [segLen, setSegLen] = useState(180)
  const [maxIterations, setMaxIterations] = useState(500)
  const [segStats, setSegStats] = useState(null)
  const [segRange, setSegRange] = useState(null)
  const [saved, setSaved] = useState(false)

  // Display options
  const [smoothFilter, setSmoothFilter] = useState(false)
  const [smoothAmount, setSmoothAmount] = useState(3) // 1-10 scale

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
          if (session.mode) setMode(session.mode)
          if (session.segLen != null) setSegLen(session.segLen)
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
        mode,
        segLen,
        maxIterations
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch (e) {
      console.warn('Failed to save analysis session:', e)
    }
  }, [data, fileName, startTime, cda, crr, wSpd, wDir, offset, range, mode, segLen, maxIterations, selectedSetup?.id])

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
      setSegs([])
      setSegStats(null)
      setSegRange(null)
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
      alert('Error saving: ' + err.message)
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
    setMode('global')
    setSegs([])
    setSegLen(180)
    setMaxIterations(500)
    setSegStats(null)
    setSegRange(null)
    setSmoothFilter(false)
    setSmoothAmount(3)
  }

  // Simulation calculation
  const sim = useMemo(() => {
    if (!data) return null
    const { pwr, v, a, ds, ele, b } = data
    const sIdx = Math.floor((range[0] / 100) * pwr.length)
    const eIdx = Math.floor((range[1] / 100) * pwr.length)

    if (sIdx >= eIdx || eIdx - sIdx < 2) {
      return { vEle: [], err: [], sIdx, eIdx, rmse: 0, anomalies: [], emptyRange: true }
    }

    const vEle = new Array(pwr.length).fill(0)
    const err = new Array(pwr.length).fill(0)
    vEle[sIdx] = ele[sIdx]
    let cur = ele[sIdx]

    const segMap = new Array(pwr.length).fill(null)
    if (mode === 'beta' && segs.length > 0) {
      segs.forEach(s => {
        for (let k = s.s; k < s.e; k++) if (k < pwr.length) segMap[k] = { cda: s.cda, crr: s.crr }
      })
    }

    const iOff = Math.round(offset)
    const wRad = wDir * (Math.PI / 180)
    let sqSum = 0, cnt = 0
    const GRAVITY = 9.81

    // Calculate mean elevation for R² calculation
    let eleSum = 0
    for (let i = sIdx; i < eIdx; i++) {
      eleSum += ele[i]
    }
    const eleMean = eleSum / (eIdx - sIdx)

    let ssTot = 0 // Total sum of squares

    for (let i = sIdx; i < eIdx; i++) {
      const vg = Math.max(0.1, v[i])
      let pi = i - iOff
      if (pi < 0) pi = 0
      if (pi >= pwr.length) pi = pwr.length - 1

      const pw = pwr[pi] * eff
      const rh = rho * Math.exp(-ele[i] / 9000)
      const va = vg + wSpd * Math.cos(b[i] * (Math.PI / 180) - wRad)

      let lCda = cda, lCrr = crr
      if (mode === 'beta' && segMap[i]) {
        lCda = segMap[i].cda
        lCrr = segMap[i].crr
      }

      const fa = 0.5 * rh * lCda * va * va * Math.sign(va)
      const ft = pw / vg
      const fr = mass * GRAVITY * lCrr
      const fac = mass * a[i]

      cur += ((ft - fr - fac - fa) / (mass * GRAVITY)) * ds[i]
      vEle[i] = cur

      const d = cur - ele[i]
      err[i] = d
      sqSum += d * d
      ssTot += (ele[i] - eleMean) ** 2
      cnt++
    }

    const rmse = cnt > 0 ? Math.sqrt(sqSum / cnt) : 0
    const r2 = ssTot > 0 ? 1 - (sqSum / ssTot) : 0

    return { vEle, err, sIdx, eIdx, rmse, r2 }
  }, [data, cda, crr, mass, eff, rho, offset, wSpd, wDir, range, segs, mode])

  // Solvers
  const runGlobal = () => {
    if (!data) return
    setBusy(true)
    setTimeout(() => {
      const res = solveCdaCrr(data, sim.sIdx, sim.eIdx, cda, crr, mass, eff, rho, offset, wSpd, wDir, false, maxIterations)
      setCda(res.cda)
      setCrr(res.crr)
      setBusy(false)
    }, 50)
  }

  const runSeg = () => {
    if (!data) return
    setBusy(true)
    setTimeout(() => {
      const s = sim.sIdx, e = sim.eIdx
      const sz = Math.max(10, Math.floor(segLen)) || 180
      let rawSegs = []
      let i

      for (i = s; i < e - sz; i += sz) {
        const r = solveCdaCrr(data, i, i + sz, cda, crr, mass, eff, rho, offset, wSpd, wDir, true, maxIterations)
        if (r.cda > 0.1 && r.cda < 0.6 && r.crr > 0.001 && r.crr < 0.015) {
          rawSegs.push({ s: i, e: i + sz, ...r })
        }
      }
      if (i < e && (e - i) >= 10) {
        const r = solveCdaCrr(data, i, e, cda, crr, mass, eff, rho, offset, wSpd, wDir, true, maxIterations)
        if (r.cda > 0.1 && r.cda < 0.6 && r.crr > 0.001 && r.crr < 0.015) {
          rawSegs.push({ s: i, e: e, ...r })
        }
      }

      const minGradeVar = 0.5
      let filteredSegs = rawSegs.filter(seg => seg.gradeVar >= minGradeVar)
      const usedMinFilter = filteredSegs.length >= 3
      if (!usedMinFilter) filteredSegs = rawSegs

      let cleanSegs = removeOutliers(filteredSegs, 'cda')
      cleanSegs = removeOutliers(cleanSegs, 'crr')
      if (cleanSegs.length < 3 && filteredSegs.length >= 3) cleanSegs = filteredSegs

      setSegs(cleanSegs)
      setSegRange([...range])

      if (cleanSegs.length > 0) {
        const totalQuality = cleanSegs.reduce((a, b) => a + b.quality, 0)
        const weightedCda = cleanSegs.reduce((a, b) => a + b.cda * b.quality, 0) / totalQuality
        const weightedCrr = cleanSegs.reduce((a, b) => a + b.crr * b.quality, 0) / totalQuality
        const simpleCda = cleanSegs.reduce((a, b) => a + b.cda, 0) / cleanSegs.length
        const simpleCrr = cleanSegs.reduce((a, b) => a + b.crr, 0) / cleanSegs.length
        const sortedCda = cleanSegs.map(s => s.cda).sort((a, b) => a - b)
        const sortedCrr = cleanSegs.map(s => s.crr).sort((a, b) => a - b)
        const medianCda = sortedCda[Math.floor(sortedCda.length / 2)]
        const medianCrr = sortedCrr[Math.floor(sortedCrr.length / 2)]
        const stdCda = Math.sqrt(cleanSegs.reduce((a, b) => a + Math.pow(b.cda - simpleCda, 2), 0) / cleanSegs.length)
        const stdCrr = Math.sqrt(cleanSegs.reduce((a, b) => a + Math.pow(b.crr - simpleCrr, 2), 0) / cleanSegs.length)
        const n = cleanSegs.length
        const ciCda = 1.96 * stdCda / Math.sqrt(n)
        const ciCrr = 1.96 * stdCrr / Math.sqrt(n)
        const avgQuality = totalQuality / cleanSegs.length
        const avgRmse = cleanSegs.reduce((a, b) => a + b.rmse, 0) / cleanSegs.length

        setSegStats({
          n: cleanSegs.length,
          rejected: rawSegs.length - cleanSegs.length,
          lowVariance: usedMinFilter ? rawSegs.length - filteredSegs.length : 0,
          weighted: { cda: weightedCda, crr: weightedCrr },
          simple: { cda: simpleCda, crr: simpleCrr },
          median: { cda: medianCda, crr: medianCrr },
          std: { cda: stdCda, crr: stdCrr },
          ci: { cda: ciCda, crr: ciCrr },
          avgQuality,
          avgRmse
        })

        setCda(weightedCda)
        setCrr(weightedCrr)
      } else {
        setSegStats(null)
      }

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

  // Chart layout
  const layout = {
    autosize: true,
    paper_bgcolor: '#0f172a',
    plot_bgcolor: '#0f172a',
    font: { color: '#94a3b8' },
    margin: { t: 40, l: 40, r: 20, b: 40 },
    grid: { rows: 3, columns: 1, pattern: 'independent' },
    showlegend: true,
    legend: { orientation: 'h', y: 1.1, x: 0 },
    xaxis: { title: 'Distance (m)', gridcolor: '#1e293b', anchor: 'y3' },
    yaxis: { title: 'Elevation (m)', gridcolor: '#1e293b', domain: [0.65, 1] },
    yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', domain: [0.35, 0.60] },
    yaxis3: { title: 'Power (W)', gridcolor: '#1e293b', domain: [0, 0.30] },
    shapes: [],
    annotations: []
  }

  // Segment annotations
  if (mode === 'beta' && segs.length && data && sim && !sim.emptyRange) {
    const visibleSegs = segs.filter(s => s.e > sim.sIdx && s.s < sim.eIdx)
    visibleSegs.forEach(s => {
      const clampedStart = Math.max(s.s, sim.sIdx)
      const clampedEnd = Math.min(s.e, sim.eIdx)
      const midIdx = Math.floor((clampedStart + clampedEnd) / 2)
      const x = (data.dist[clampedStart] + data.dist[clampedEnd]) / 2
      const y = sim.vEle[midIdx] || data.ele[midIdx]

      if (s.s >= sim.sIdx && s.s < sim.eIdx) {
        layout.shapes.push({
          type: 'line', x0: data.dist[s.s], x1: data.dist[s.s], y0: 0, y1: 1, xref: 'x', yref: 'paper',
          line: { color: 'rgba(255,255,255,0.1)', width: 1, dash: 'dot' }
        })
      }

      layout.annotations.push({
        x, y, xref: 'x', yref: 'y',
        text: `CdA:${s.cda.toFixed(5)}<br>Crr:${s.crr.toFixed(5)}`,
        showarrow: true, arrowhead: 0, ay: -30,
        font: { color: '#4ade80', size: 9 },
        bgcolor: 'rgba(0,0,0,0.7)', borderpad: 2, bordercolor: '#4ade80', borderwidth: 1, opacity: 0.9
      })
    })
  }

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
              <div className="flex bg-dark-input p-0.5 rounded border border-dark-border mb-3">
                <button onClick={() => setMode('global')} className={`px-3 py-1 rounded text-xs font-medium flex-1 ${mode === 'global' ? 'bg-slate-600 text-white' : 'text-gray-400'}`}>Global</button>
                <button onClick={() => setMode('beta')} className={`px-3 py-1 rounded text-xs font-medium flex-1 ${mode === 'beta' ? 'bg-emerald-700 text-white' : 'text-gray-400'}`}>Segmented</button>
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-gray-500 mb-1 block">Max Iterations</label>
                <div className="flex gap-2">
                  <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark flex-1" />
                  <button onClick={() => setMaxIterations(500)} className="px-2 text-xs text-gray-400 hover:text-white border border-dark-border rounded hover:bg-dark-input transition-colors" title="Reset to default (500)">↺</button>
                </div>
              </div>

              {mode === 'global' ? (
                <button onClick={runGlobal} disabled={busy} className="btn-primary w-full">
                  {busy ? 'Optimizing...' : 'Auto-Fit'}
                </button>
              ) : (
                <>
                  <div className="mb-2">
                    <label className="text-[10px] text-gray-500 mb-1 block">Segment Length</label>
                    <input type="number" value={segLen} onChange={e => setSegLen(safeNum(e.target.value, segLen))} className="input-dark w-full" />
                  </div>
                  <button onClick={runSeg} disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded font-medium text-xs transition-colors">
                    {busy ? 'Crunching...' : 'Run Segments'}
                  </button>

                  {segs.length > 0 && segStats && (
                    <div className="bg-dark-input p-3 rounded text-[10px] border border-dark-border mt-2 space-y-3">
                      {segRange && (range[0] !== segRange[0] || range[1] !== segRange[1]) && (
                        <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded text-yellow-300">
                          <span>Range changed - re-run</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pb-2 border-b border-dark-border">
                        <span className="text-gray-400">Valid Segments</span>
                        <span className="text-white font-bold">{segStats.n}</span>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-green-400 font-medium">CdA (Weighted)</span>
                          <span className="text-green-400 font-mono font-bold">{segStats.weighted.cda.toFixed(5)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>95% CI</span>
                          <span className="font-mono">± {segStats.ci.cda.toFixed(5)}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-blue-400 font-medium">Crr (Weighted)</span>
                          <span className="text-blue-400 font-mono font-bold">{segStats.weighted.crr.toFixed(5)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>95% CI</span>
                          <span className="font-mono">± {segStats.ci.crr.toFixed(5)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {segs.length > 0 && (
                    <button onClick={() => { setSegs([]); setSegStats(null); setSegRange(null) }} className="w-full mt-2 bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded text-xs">
                      Reset
                    </button>
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
        {/* Crop Controls */}
        {data && (
          <div className="flex items-center gap-6 px-6 py-3 border-b border-dark-border bg-dark-card/50">
            <span className="text-sm font-bold text-white uppercase tracking-wider">Crop Range</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Start</span>
              <input type="range" min="0" max="100" value={range[0]} onChange={e => setRange([Math.min(parseInt(e.target.value), range[1] - 1), range[1]])} className="w-32 accent-brand-primary" />
              <span className="text-xs font-mono text-brand-accent w-10">{range[0]}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">End</span>
              <input type="range" min="0" max="100" value={range[1]} onChange={e => setRange([range[0], Math.max(parseInt(e.target.value), range[0] + 1)])} className="w-32 accent-brand-primary" />
              <span className="text-xs font-mono text-brand-accent w-10">{range[1]}%</span>
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
                  const distSlice = data.dist.slice(sim.sIdx, sim.eIdx)
                  const eleSlice = data.ele.slice(sim.sIdx, sim.eIdx)
                  const vEleSlice = sim.vEle.slice(sim.sIdx, sim.eIdx)
                  const errSlice = sim.err.slice(sim.sIdx, sim.eIdx)
                  const pwrSlice = data.pwr.slice(sim.sIdx, sim.eIdx)

                  // Apply smoothing filter if enabled
                  const displayEle = smoothFilter ? smoothData(eleSlice, smoothAmount) : eleSlice
                  const displayVEle = smoothFilter ? smoothData(vEleSlice, smoothAmount) : vEleSlice

                  return [
                    { x: distSlice, y: displayEle, type: 'scatter', mode: 'lines', name: 'GPS Elev', line: { color: '#ef4444', width: 2 }, opacity: 0.6 },
                    { x: distSlice, y: displayVEle, type: 'scatter', mode: 'lines', name: 'Virtual Elev', line: { color: '#06b6d4', width: 2 } },
                    { x: distSlice, y: errSlice, type: 'scatter', mode: 'lines', name: 'Delta', line: { color: '#a855f7', width: 1 }, xaxis: 'x', yaxis: 'y2', fill: 'tozeroy' },
                    { x: distSlice, y: pwrSlice, type: 'scatter', mode: 'lines', name: 'Power', line: { color: '#f97316', width: 1 }, xaxis: 'x', yaxis: 'y3', fill: 'tozeroy', opacity: 0.3 }
                  ]
                })()}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
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
    </div>
  )
}
