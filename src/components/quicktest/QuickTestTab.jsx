import { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import { useAuth } from '../../hooks/useAuth.jsx'
import { parseGPX } from '../../lib/gpxParser'
import { solveCdaCrr, removeOutliers, safeNum } from '../../lib/physics'
import { lowPassFilter } from '../../lib/preprocessing'

export const QuickTestTab = () => {
  const { user } = useAuth()

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

  // Low-pass filter (for display only)
  const [filterGps, setFilterGps] = useState(false)
  const [filterVirtual, setFilterVirtual] = useState(false)
  const [filterIntensity, setFilterIntensity] = useState(5)

  // File Handler
  const onFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    const r = new FileReader()
    r.onload = (ev) => {
      const result = parseGPX(ev.target.result)
      setData(result.data)
      setStartTime(result.startTime)
      setSegs([])
      setSegStats(null)
    }
    r.readAsText(f)
  }

  // Reset analysis
  const resetAnalysis = () => {
    setData(null)
    setFileName(null)
    setCda(0.32)
    setCrr(0.004)
    setWSpd(0)
    setWDir(0)
    setOffset(0)
    setRange([0, 100])
    setMode('global')
    setSegs([])
    setSegLen(180)
    setMaxIterations(500)
    setSegStats(null)
    setFilterGps(false)
    setFilterVirtual(false)
    setFilterIntensity(5)
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

    let eleSum = 0
    for (let i = sIdx; i < eIdx; i++) {
      eleSum += ele[i]
    }
    const eleMean = eleSum / (eIdx - sIdx)
    let ssTot = 0

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

      if (cleanSegs.length > 0) {
        const totalQuality = cleanSegs.reduce((a, b) => a + b.quality, 0)
        const weightedCda = cleanSegs.reduce((a, b) => a + b.cda * b.quality, 0) / totalQuality
        const weightedCrr = cleanSegs.reduce((a, b) => a + b.crr * b.quality, 0) / totalQuality

        setSegStats({
          n: cleanSegs.length,
          rejected: rawSegs.length - cleanSegs.length,
          weighted: { cda: weightedCda, crr: weightedCrr }
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
    font: { color: '#94a3b8', size: 11 },
    margin: { t: 50, l: 50, r: 20, b: 40 },
    grid: { rows: 3, columns: 1, pattern: 'independent' },
    showlegend: true,
    legend: { orientation: 'h', y: 1.02, x: 0, font: { size: 10 } },
    xaxis: { title: 'Distance (m)', gridcolor: '#1e293b', anchor: 'y3' },
    yaxis: { title: 'Elevation (m)', gridcolor: '#1e293b', domain: [0.68, 1] },
    yaxis2: { title: 'Error (m)', gridcolor: '#1e293b', domain: [0.36, 0.62] },
    yaxis3: { title: 'Power (W)', gridcolor: '#1e293b', domain: [0, 0.30] },
    shapes: [],
    annotations: []
  }

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
              <label className="text-[10px] text-gray-500 mb-1 block">Air Density (kg/m³)</label>
              <input
                type="number"
                step="0.001"
                value={rho}
                onChange={e => setRho(safeNum(e.target.value, rho))}
                className="input-dark w-full"
              />
              <p className="text-[10px] text-gray-600 mt-0.5">Sea level: 1.225</p>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="card">
          <label className="block w-full cursor-pointer bg-brand-primary hover:bg-indigo-600 text-white text-center py-2.5 rounded font-medium transition-colors">
            Upload GPX File
            <input type="file" accept=".gpx" onChange={onFile} className="hidden" />
          </label>
          {!data && <p className="text-center text-xs text-gray-500 mt-2">Upload a GPX with power data</p>}
          {data && fileName && (
            <div className="mt-2">
              <p className="text-center text-xs text-gray-400 truncate">{fileName}</p>
              <button onClick={resetAnalysis} className="w-full mt-2 text-xs text-gray-400 hover:text-white border border-dark-border rounded py-1 hover:bg-dark-input transition-colors">
                Clear & Reset
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
                <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark w-full" />
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
                    <div className="bg-dark-input p-3 rounded text-[10px] border border-dark-border mt-2">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-400">Valid Segments</span>
                        <span className="text-white font-bold">{segStats.n}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400">Weighted CdA</span>
                        <span className="text-green-400 font-mono">{segStats.weighted.cda.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-400">Weighted Crr</span>
                        <span className="text-blue-400 font-mono">{segStats.weighted.crr.toFixed(5)}</span>
                      </div>
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
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-orange-400">Time Lag</span>
                    <span className="text-gray-400">{offset}s</span>
                  </div>
                  <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className="slider-lag" />
                </div>
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
            {sim && sim.r2 > 0 && (
              <div className="card bg-gradient-to-r from-indigo-900/30 to-dark-card border-indigo-500/30">
                <h3 className="text-xs text-gray-400 uppercase mb-2">Results</h3>
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
                <p className="text-[10px] text-gray-500 mt-2">
                  To save results and track over time, create a study.
                </p>
              </div>
            )}
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
        )}

        <div className="flex-1">
          {data ? (
            sim && sim.emptyRange ? (
              <div className="flex flex-col items-center justify-center h-full text-yellow-500 space-y-4">
                <p className="text-lg font-medium">Range too narrow</p>
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

                  const displayEle = filterGps ? lowPassFilter(eleSlice, filterIntensity) : eleSlice
                  const displayVEle = filterVirtual ? lowPassFilter(vEleSlice, filterIntensity) : vEleSlice

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
    </div>
  )
}
