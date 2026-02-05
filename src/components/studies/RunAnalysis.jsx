import { useState, useMemo, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { parseActivityFile } from '../../lib/activityFileParser'
import { solveCdaCrr, safeNum, GRAVITY } from '../../lib/physics'
import { lowPassFilter } from '../../lib/preprocessing'
import { useRuns } from '../../hooks/useRuns'
import { getVariableType } from '../../lib/variableTypes'
import { calculateAirDensity } from '../../lib/airDensity'
import { ConfirmDialog, AlertDialog } from '../ui'

export const RunAnalysis = ({ variation, study, onBack }) => {
  const { runs, stats, createRun, toggleValid, deleteRun, refresh } = useRuns(variation.id)
  const variableType = getVariableType(study.variable_type)

  // Get physics from base setup or defaults
  const mass = study.mass || 80
  const eff = study.drivetrain_efficiency || 0.97
  const [rho, setRho] = useState(1.225)

  // Air density calculator state
  const [showRhoCalc, setShowRhoCalc] = useState(false)
  const [rhoTemp, setRhoTemp] = useState(20) // °C
  const [rhoElevation, setRhoElevation] = useState(0) // m
  const [rhoPressure, setRhoPressure] = useState(1013.25) // hPa
  const [rhoHumidity, setRhoHumidity] = useState(50) // %
  const [rhoUseElevation, setRhoUseElevation] = useState(true)

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

  // CdA/Crr state
  const [cda, setCda] = useState(0.32)
  const [crr, setCrr] = useState(0.004)

  // Nudge amounts for fine-tuning
  const [cdaNudge, setCdaNudge] = useState(0.001)
  const [crrNudge, setCrrNudge] = useState(0.0001)

  const [data, setData] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [lapMarkers, setLapMarkers] = useState([])

  // Smart recording warning
  const [smartRecordingWarning, setSmartRecordingWarning] = useState(null)

  // Environment
  const [wSpd, setWSpd] = useState(0)
  const [wDir, setWDir] = useState(0)
  const [offset, setOffset] = useState(0)
  const [range, setRange] = useState([0, 100])

  // Solver
  const [busy, setBusy] = useState(false)
  const [fetchingW, setFetchingW] = useState(false)
  const [weatherError, setWeatherError] = useState(null)
  const [maxIterations, setMaxIterations] = useState(500)
  const [saved, setSaved] = useState(false)

  // Display
  const [showRuns, setShowRuns] = useState(false)

  // Low-pass filter (for display only)
  const [filterGps, setFilterGps] = useState(false)
  const [filterVirtual, setFilterVirtual] = useState(false)
  const [filterIntensity, setFilterIntensity] = useState(5)

  // Y-axis autoscale (scale to visible range)
  const [autoScaleY, setAutoScaleY] = useState(false)

  // Lap markers visibility
  const [showLaps, setShowLaps] = useState(true)

  // Dialog state
  const [deleteDialog, setDeleteDialog] = useState({ open: false, runId: null, runName: '' })
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })

  // File Handler
  const onFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    setSaved(false)
    try {
      const result = await parseActivityFile(f)
      setData(result.data)
      setStartTime(result.startTime)
      setLapMarkers(result.lapMarkers || [])
      if (result.isSmartRecording) {
        setSmartRecordingWarning({
          fileName: f.name,
          avgInterval: result.avgInterval
        })
      }
    } catch (err) {
      console.error('File parse error:', err)
      alert(err.message || 'Failed to parse file')
    }
  }

  // Reset analysis
  const resetAnalysis = () => {
    setCda(0.32)
    setCrr(0.004)
    setWSpd(0)
    setWDir(0)
    setOffset(0)
    setRange([0, 100])
    setMaxIterations(500)
    setFilterGps(false)
    setFilterVirtual(false)
    setFilterIntensity(5)
    setLapMarkers([])
    setAutoScaleY(false)
    setShowLaps(true)
  }

  // Simulation calculation - compute virtual elevation for SELECTED RANGE ONLY
  // Uses segment start values (i-1) for proper alignment
  const sim = useMemo(() => {
    if (!data) return null
    const { pwr, v, a, ds, ele, b } = data
    // Use consistent index calculation: round to nearest index
    const sIdx = Math.round((range[0] / 100) * (pwr.length - 1))
    const eIdx = Math.round((range[1] / 100) * (pwr.length - 1))

    if (sIdx >= eIdx || eIdx - sIdx < 2) {
      return { vEle: [], err: [], sIdx, eIdx, rmse: 0, anomalies: [], emptyRange: true }
    }

    const iOff = Math.round(offset)
    const wRad = wDir * (Math.PI / 180)

    // Arrays for the selected range only (same length as full data for chart compatibility)
    const vEle = new Array(pwr.length)
    const err = new Array(pwr.length)

    // Start fresh at GPS elevation of range start
    const rangeStartElev = ele[sIdx]
    let cur = rangeStartElev

    // Compute virtual elevation for selected range
    // Use physics values from START of each segment (i-1) for proper alignment
    for (let i = sIdx; i < eIdx; i++) {
      if (i > sIdx) {
        const segStart = i - 1
        const vg = Math.max(0.1, v[segStart])
        let pi = segStart - iOff
        if (pi < 0) pi = 0
        if (pi >= pwr.length) pi = pwr.length - 1

        const pw = pwr[pi] * eff
        const rh = rho * Math.exp(-ele[segStart] / 9000)
        const va = vg + wSpd * Math.cos(b[segStart] * (Math.PI / 180) - wRad)

        const fa = 0.5 * rh * cda * va * va * Math.sign(va)
        const ft = pw / vg
        const fr = mass * GRAVITY * crr
        const fac = mass * a[segStart]

        cur += ((ft - fr - fac - fa) / (mass * GRAVITY)) * ds[i]
      }
      vEle[i] = cur
      err[i] = cur - ele[i]
    }

    // Fill outside range with boundary values (no discontinuity)
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
      setWeatherError('Failed to fetch')
    }
    setFetchingW(false)
  }

  // Saving state
  const [saving, setSaving] = useState(false)

  // Save run
  const saveRun = async () => {
    setSaving(true)
    try {
      const runNumber = runs.length + 1
      await createRun({
        name: `Run ${runNumber}`,
        gpx_filename: fileName || null,
        fitted_cda: cda,
        fitted_crr: crr,
        rmse: sim?.rmse || null,
        r2: sim?.r2 || null,
        wind_speed: wSpd,
        wind_direction: wDir,
        ride_date: startTime ? startTime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: `RMSE: ${sim?.rmse?.toFixed(3) || 'N/A'}m, R²: ${sim?.r2?.toFixed(4) || 'N/A'}`
      })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setData(null)
        setFileName(null)
        resetAnalysis()
      }, 1500)
    } catch (err) {
      setErrorDialog({ open: true, message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Binary search to find closest index to a target distance
  const findClosestIndex = useCallback((distArray, targetDist) => {
    if (!distArray || distArray.length === 0) return 0
    if (targetDist <= distArray[0]) return 0
    if (targetDist >= distArray[distArray.length - 1]) return distArray.length - 1

    let lo = 0, hi = distArray.length - 1
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2)
      if (distArray[mid] <= targetDist) lo = mid
      else hi = mid
    }
    return (targetDist - distArray[lo] <= distArray[hi] - targetDist) ? lo : hi
  }, [])

  // Range is stored as INDEX percentage for accurate cropping
  const distanceRange = useMemo(() => {
    if (!data) return [0, 0]
    const sIdx = Math.round((range[0] / 100) * (data.dist.length - 1))
    const eIdx = Math.round((range[1] / 100) * (data.dist.length - 1))
    return [data.dist[sIdx] || 0, data.dist[eIdx] || 0]
  }, [data, range])

  // Handle rangeslider changes - convert distance to closest index
  const handleRelayout = useCallback((eventData) => {
    if (!data) return
    const len = data.dist.length
    const maxDist = data.dist[len - 1]

    let newStartDist, newEndDist
    if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
      newStartDist = Math.max(0, eventData['xaxis.range[0]'])
      newEndDist = Math.min(maxDist, eventData['xaxis.range[1]'])
    } else if (eventData['xaxis.range']) {
      [newStartDist, newEndDist] = eventData['xaxis.range']
      newStartDist = Math.max(0, newStartDist)
      newEndDist = Math.min(maxDist, newEndDist)
    } else {
      return
    }

    // Find closest indices to the selected distances
    const startIdx = findClosestIndex(data.dist, newStartDist)
    const endIdx = findClosestIndex(data.dist, newEndDist)

    // Convert indices to percentages
    const startPct = (startIdx / (len - 1)) * 100
    const endPct = (endIdx / (len - 1)) * 100

    if (Math.abs(startPct - range[0]) > 0.0001 || Math.abs(endPct - range[1]) > 0.0001) {
      setRange([startPct, endPct])
    }
  }, [data, range, findClosestIndex])

  // Nudge range by exactly 1 index
  const nudgeRange = useCallback((edge, direction) => {
    if (!data) return
    const len = data.dist.length

    const startIdx = Math.round((range[0] / 100) * (len - 1))
    const endIdx = Math.round((range[1] / 100) * (len - 1))

    if (edge === 'start') {
      const newStartIdx = Math.max(0, Math.min(endIdx - 1, startIdx + direction))
      const newStartPct = (newStartIdx / (len - 1)) * 100
      setRange([newStartPct, range[1]])
    } else {
      const newEndIdx = Math.min(len - 1, Math.max(startIdx + 1, endIdx + direction))
      const newEndPct = (newEndIdx / (len - 1)) * 100
      setRange([range[0], newEndPct])
    }
  }, [data, range])

  // Calculate Y-axis range for visible data (when autoScaleY is enabled)
  const visibleYRange = useMemo(() => {
    if (!autoScaleY || !data || !sim) return null

    const startDist = distanceRange[0]
    const endDist = distanceRange[1]

    let minEle = Infinity, maxEle = -Infinity
    let minErr = Infinity, maxErr = -Infinity
    let minPwr = Infinity, maxPwr = -Infinity

    const displayEle = filterGps ? lowPassFilter(data.ele, filterIntensity) : data.ele
    const displayVEle = filterVirtual ? lowPassFilter(sim.vEle, filterIntensity) : sim.vEle

    for (let i = 0; i < data.dist.length; i++) {
      if (data.dist[i] >= startDist && data.dist[i] <= endDist) {
        if (displayEle[i] !== undefined) {
          minEle = Math.min(minEle, displayEle[i])
          maxEle = Math.max(maxEle, displayEle[i])
        }
        if (displayVEle[i] !== undefined) {
          minEle = Math.min(minEle, displayVEle[i])
          maxEle = Math.max(maxEle, displayVEle[i])
        }
        if (sim.err[i] !== undefined) {
          minErr = Math.min(minErr, sim.err[i])
          maxErr = Math.max(maxErr, sim.err[i])
        }
        if (data.pwr[i] !== undefined) {
          minPwr = Math.min(minPwr, data.pwr[i])
          maxPwr = Math.max(maxPwr, data.pwr[i])
        }
      }
    }

    const elePadding = (maxEle - minEle) * 0.05 || 1
    const errPadding = (maxErr - minErr) * 0.05 || 0.5
    const pwrPadding = (maxPwr - minPwr) * 0.05 || 10

    return {
      elevation: [minEle - elePadding, maxEle + elePadding],
      error: [minErr - errPadding, maxErr + errPadding],
      power: [minPwr - pwrPadding, maxPwr + pwrPadding]
    }
  }, [autoScaleY, data, sim, distanceRange, filterGps, filterVirtual, filterIntensity])

  // Chart layout with rangeslider
  const layout = useMemo(() => {
    // Create lap marker shapes and annotations
    const lapShapes = showLaps ? lapMarkers.map(lap => ({
      type: 'line',
      x0: lap.distance,
      x1: lap.distance,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: 'rgba(255, 255, 255, 0.6)', width: 1, dash: 'dot' }
    })) : []

    const lapAnnotations = showLaps ? lapMarkers.map(lap => ({
      x: lap.distance,
      y: 1,
      yref: 'paper',
      text: lap.name,
      showarrow: false,
      font: { size: 9, color: 'rgba(255, 255, 255, 0.8)' },
      textangle: -90,
      xanchor: 'left',
      yanchor: 'top',
      xshift: 3
    })) : []

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
      yaxis: {
        title: 'Elevation (m)',
        gridcolor: '#1e293b',
        domain: [0.55, 1],
        ...(visibleYRange?.elevation && { range: visibleYRange.elevation })
      },
      yaxis2: {
        title: 'Error (m)',
        gridcolor: '#1e293b',
        domain: [0.30, 0.50],
        ...(visibleYRange?.error && { range: visibleYRange.error })
      },
      yaxis3: {
        title: 'Power (W)',
        gridcolor: '#1e293b',
        domain: [0.08, 0.26],
        ...(visibleYRange?.power && { range: visibleYRange.power })
      },
      shapes: lapShapes,
      annotations: lapAnnotations
    }
  }, [distanceRange, visibleYRange, lapMarkers, showLaps])

  const handleDeleteRun = (runId, runName) => {
    setDeleteDialog({ open: true, runId, runName })
  }

  const confirmDeleteRun = async () => {
    if (deleteDialog.runId) {
      await deleteRun(deleteDialog.runId)
      setDeleteDialog({ open: false, runId: null, runName: '' })
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar Controls */}
      <div className="w-72 flex-shrink-0 border-r border-dark-border overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h3 className="font-bold text-white text-sm">{variation.name}</h3>
            <p className="text-xs text-gray-500">{variableType.formatValue(variation)}</p>
          </div>
        </div>

        {/* Variation Stats */}
        <div className="card bg-gradient-to-r from-indigo-900/30 to-dark-card border-indigo-500/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">Variation Stats</span>
            <button
              onClick={() => setShowRuns(!showRuns)}
              className="text-xs text-brand-primary hover:text-brand-accent"
            >
              {showRuns ? 'Hide Runs' : `${runs.length} Runs`}
            </button>
          </div>
          {stats.count > 0 ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Avg CdA</span>
                <div className="font-mono text-green-400">{stats.avgCda?.toFixed(4)}</div>
              </div>
              <div>
                <span className="text-gray-500">Avg Crr</span>
                <div className="font-mono text-blue-400">{stats.avgCrr?.toFixed(5)}</div>
              </div>
              {stats.stdCda && (
                <div className="col-span-2">
                  <span className="text-gray-500">CdA ±</span>
                  <span className="font-mono text-gray-400 ml-1">{stats.stdCda.toFixed(4)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No valid runs yet</p>
          )}
        </div>

        {/* Runs List (collapsible) */}
        {showRuns && runs.length > 0 && (
          <div className="card space-y-2 max-h-48 overflow-y-auto">
            {runs.map(run => (
              <div
                key={run.id}
                className={`flex items-center justify-between p-2 rounded border text-xs ${
                  run.is_valid
                    ? 'bg-dark-bg border-dark-border'
                    : 'bg-red-900/20 border-red-500/30 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate">{run.name}</p>
                  <p className="text-gray-500 font-mono">
                    CdA: {run.fitted_cda?.toFixed(4)} | Crr: {run.fitted_crr?.toFixed(5)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleValid(run.id)}
                    className={`p-1 rounded ${run.is_valid ? 'text-green-400' : 'text-red-400'}`}
                    title={run.is_valid ? 'Mark invalid' : 'Mark valid'}
                  >
                    {run.is_valid ? '✓' : '✗'}
                  </button>
                  <button
                    onClick={() => handleDeleteRun(run.id, run.name)}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File Upload */}
        <div className="card">
          <label className="block w-full cursor-pointer bg-brand-primary hover:bg-indigo-600 text-white text-center py-2 rounded font-medium transition-colors">
            Upload GPX/FIT File
            <input type="file" accept=".gpx,.fit" onChange={onFile} className="hidden" />
          </label>
          {!data && <p className="text-center text-xs text-gray-500 mt-2">Upload a file to add a run</p>}
          {data && fileName && (
            <div className="mt-2">
              <p className="text-center text-xs text-gray-400 truncate">{fileName}</p>
              <button onClick={resetAnalysis} className="w-full mt-2 text-xs text-gray-400 hover:text-white border border-dark-border rounded py-1 hover:bg-dark-input transition-colors">
                Reset
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
                <label className="text-xxs text-gray-500 mb-1 block">Max Iterations</label>
                <input type="number" min="50" max="2000" step="50" value={maxIterations} onChange={e => setMaxIterations(safeNum(e.target.value, maxIterations))} className="input-dark w-full" />
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
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-green-400 font-medium">CdA</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={cdaNudge}
                        onChange={e => setCdaNudge(parseFloat(e.target.value))}
                        className="text-xxs bg-dark-input border border-dark-border rounded px-1 py-0.5 text-gray-400"
                        title="Nudge amount"
                      >
                        <option value="0.01">±0.01</option>
                        <option value="0.001">±0.001</option>
                        <option value="0.0001">±0.0001</option>
                      </select>
                      <span className="font-mono font-bold">{cda.toFixed(4)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCda(Math.max(0.15, cda - cdaNudge))}
                      className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-green-500/50 text-sm font-bold"
                    >−</button>
                    <input
                      type="range"
                      min="0.15"
                      max="0.5"
                      step="0.0001"
                      value={cda}
                      onChange={e => setCda(parseFloat(e.target.value))}
                      className="slider-cda flex-1"
                    />
                    <button
                      onClick={() => setCda(Math.min(0.5, cda + cdaNudge))}
                      className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-green-500/50 text-sm font-bold"
                    >+</button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-blue-400 font-medium">Crr</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={crrNudge}
                        onChange={e => setCrrNudge(parseFloat(e.target.value))}
                        className="text-xxs bg-dark-input border border-dark-border rounded px-1 py-0.5 text-gray-400"
                        title="Nudge amount"
                      >
                        <option value="0.001">±0.001</option>
                        <option value="0.0001">±0.0001</option>
                        <option value="0.00001">±0.00001</option>
                      </select>
                      <span className="font-mono font-bold">{crr.toFixed(6)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCrr(Math.max(0.002, crr - crrNudge))}
                      className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-blue-500/50 text-sm font-bold"
                    >−</button>
                    <input
                      type="range"
                      min="0.002"
                      max="0.02"
                      step="0.00001"
                      value={crr}
                      onChange={e => setCrr(parseFloat(e.target.value))}
                      className="slider-crr flex-1"
                    />
                    <button
                      onClick={() => setCrr(Math.min(0.02, crr + crrNudge))}
                      className="w-6 h-6 rounded bg-dark-input border border-dark-border text-gray-400 hover:text-white hover:border-blue-500/50 text-sm font-bold"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Experimental Features */}
            <div className="card border-yellow-500/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xxs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase font-medium">Beta</span>
                <h3 className="label-sm">Experimental</h3>
              </div>

              {/* Environment */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400">Wind Correction</span>
                  <button onClick={getWeather} disabled={fetchingW} className="btn-secondary text-xxs py-0.5 px-2">
                    {fetchingW ? '...' : 'Fetch'}
                  </button>
                </div>
                {weatherError && (
                  <p className="text-xxs text-red-400 mb-2">{weatherError}</p>
                )}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xxs text-gray-500 mb-1 block">Speed (m/s)</label>
                    <input type="number" step="0.1" value={wSpd} onChange={e => setWSpd(safeNum(e.target.value, wSpd))} className="input-dark w-full" />
                  </div>
                  <div>
                    <label className="text-xxs text-gray-500 mb-1 block">Dir (°)</label>
                    <input type="number" step="1" value={wDir} onChange={e => setWDir(safeNum(e.target.value, wDir))} className="input-dark w-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xxs mb-1">
                    <span className="text-orange-400">Time Lag</span>
                    <span className="text-gray-400">{offset}s</span>
                  </div>
                  <input type="range" min="-5" max="5" step="0.5" value={offset} onChange={e => setOffset(parseFloat(e.target.value))} className="slider-lag" />
                </div>
              </div>

              {/* Air Density */}
              <div className="pt-3 border-t border-dark-border mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Air Density (kg/m³)</span>
                  <button
                    onClick={() => setShowRhoCalc(!showRhoCalc)}
                    className="text-xxs text-indigo-400 hover:text-indigo-300"
                  >
                    {showRhoCalc ? 'Hide' : 'Calculator'}
                  </button>
                </div>
                <input
                  type="number"
                  step="0.001"
                  value={rho}
                  onChange={e => setRho(safeNum(e.target.value, rho))}
                  className="input-dark w-full"
                />

                {showRhoCalc && (
                  <div className="mt-3 p-3 bg-dark-bg rounded border border-dark-border space-y-3">
                    <p className="text-xxs text-gray-400 font-medium">Calculate from conditions:</p>

                    <div>
                      <label className="text-xxs text-gray-500 mb-1 block">Temperature (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rhoTemp}
                        onChange={e => setRhoTemp(safeNum(e.target.value, rhoTemp))}
                        className="input-dark w-full"
                      />
                    </div>

                    <div>
                      <div className="flex bg-dark-input p-0.5 rounded border border-dark-border mb-2">
                        <button
                          onClick={() => setRhoUseElevation(true)}
                          className={`px-2 py-1 rounded text-xxs font-medium flex-1 ${rhoUseElevation ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        >
                          Elevation
                        </button>
                        <button
                          onClick={() => setRhoUseElevation(false)}
                          className={`px-2 py-1 rounded text-xxs font-medium flex-1 ${!rhoUseElevation ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        >
                          Pressure
                        </button>
                      </div>

                      {rhoUseElevation ? (
                        <div>
                          <label className="text-xxs text-gray-500 mb-1 block">Elevation (m)</label>
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
                          <label className="text-xxs text-gray-500 mb-1 block">Pressure (hPa)</label>
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

                    <div>
                      <label className="text-xxs text-gray-500 mb-1 block">Relative Humidity (%)</label>
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

                    <div className="pt-2 border-t border-dark-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xxs text-gray-400">Calculated:</span>
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

              {/* Low-pass Filter */}
              <div className="pt-3 border-t border-dark-border">
                <span className="text-xs text-gray-400 mb-2 block">Low-pass Filter</span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xxs text-gray-500">GPS Elevation</span>
                    <button
                      onClick={() => setFilterGps(!filterGps)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${filterGps ? 'bg-emerald-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${filterGps ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xxs text-gray-500">Virtual Elevation</span>
                    <button
                      onClick={() => setFilterVirtual(!filterVirtual)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${filterVirtual ? 'bg-emerald-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${filterVirtual ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className={`transition-opacity ${(filterGps || filterVirtual) ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex justify-between text-xxs mb-1">
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

            {/* Save Run Button */}
            <button
              onClick={saveRun}
              disabled={saved || saving}
              className={`w-full py-2 rounded font-medium text-sm transition-all ${
                saved
                  ? 'bg-green-600 text-white'
                  : saving
                    ? 'bg-gray-600 text-gray-300 cursor-wait'
                    : 'bg-brand-primary hover:bg-indigo-600 text-white'
              }`}
            >
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Run'}
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
              {/* Start nudge - 1 data point per click */}
              <div className="flex items-center">
                <button
                  onClick={() => nudgeRange('start', -1)}
                  className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-l border border-dark-border hover:bg-dark-input"
                  title="Move start back 1 point"
                >◀</button>
                <button
                  onClick={() => nudgeRange('start', 1)}
                  className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-r border border-l-0 border-dark-border hover:bg-dark-input"
                  title="Move start forward 1 point"
                >▶</button>
              </div>
              <span className="text-xs font-mono text-brand-accent">{Math.round(distanceRange[0])}m - {Math.round(distanceRange[1])}m</span>
              {/* End nudge - 1 data point per click */}
              <div className="flex items-center">
                <button
                  onClick={() => nudgeRange('end', -1)}
                  className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-l border border-dark-border hover:bg-dark-input"
                  title="Move end back 1 point"
                >◀</button>
                <button
                  onClick={() => nudgeRange('end', 1)}
                  className="text-xxs text-gray-500 hover:text-white px-1 py-0.5 rounded-r border border-l-0 border-dark-border hover:bg-dark-input"
                  title="Move end forward 1 point"
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
                className={`text-xxs px-1.5 py-0.5 rounded border ${autoScaleY ? 'bg-indigo-900/50 border-indigo-500/50 text-indigo-400' : 'border-dark-border text-gray-500 hover:text-white hover:bg-dark-input'}`}
                title="Auto-scale Y axis to visible data"
              >
                Autoscale Y
              </button>
              {lapMarkers.length > 0 && (
                <button
                  onClick={() => setShowLaps(!showLaps)}
                  className={`text-xxs px-1.5 py-0.5 rounded border ${showLaps ? 'bg-white/10 border-white/30 text-white' : 'border-dark-border text-gray-500 hover:text-white hover:bg-dark-input'}`}
                  title="Show/hide lap markers"
                >
                  Laps ({lapMarkers.length})
                </button>
              )}
            </div>
            {(filterGps || filterVirtual) && (
              <span className="text-xxs px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-500/30">
                Filtered
              </span>
            )}

            {/* Prominent RMSE & R² Display */}
            {sim && !sim.emptyRange && (
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border">
                  <span className="text-xxs text-gray-500 uppercase">RMSE</span>
                  <span className={`text-lg font-mono font-bold ${sim.rmse < 1 ? 'text-emerald-400' : sim.rmse < 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {sim.rmse.toFixed(2)}m
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border">
                  <span className="text-xxs text-gray-500 uppercase">R²</span>
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
                <p className="text-sm text-gray-500">Use the rangeslider below the chart</p>
              </div>
            ) : (
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
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
              <p className="text-lg">Upload a GPX/FIT file to add a run to this variation</p>
              <p className="text-sm text-gray-600">Each run will contribute to the variation's average CdA/Crr</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, runId: null, runName: '' })}
        onConfirm={confirmDeleteRun}
        title="Delete Run"
        message={`Are you sure you want to delete "${deleteDialog.runName}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Error Alert Dialog */}
      <AlertDialog
        isOpen={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, message: '' })}
        title="Error Saving"
        message={errorDialog.message}
        variant="error"
      />

      {/* Smart Recording Warning Modal */}
      {smartRecordingWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-md mx-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Smart Recording Detected</h3>
                <p className="text-sm text-gray-400 mb-3">
                  The file <span className="text-white font-medium">{smartRecordingWarning.fileName}</span> appears to use smart recording (avg interval: {smartRecordingWarning.avgInterval}s) instead of 1-second recording.
                </p>
                <p className="text-sm text-gray-400 mb-4">
                  For accurate CdA/Crr results, set your head unit to record at <strong className="text-white">1-second intervals</strong>. Smart recording creates gaps in the data that can affect analysis accuracy.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setSmartRecordingWarning(null)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
