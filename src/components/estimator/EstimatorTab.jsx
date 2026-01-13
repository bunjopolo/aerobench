import { useState, useMemo } from 'react'
import { parseRouteGPX } from '../../lib/gpxParser'
import { solveVelocity, safeNum } from '../../lib/physics'

export const EstimatorTab = ({ physics, selectedSetup, setups, onSelectSetup }) => {
  const { cda, crr, mass, eff, rho } = physics

  const [mode, setMode] = useState('manual')
  const [estPwr, setEstPwr] = useState(250)
  const [estGrade, setEstGrade] = useState(0)
  const [estDist, setEstDist] = useState(40)

  // Comparison setup (optional)
  const [compareSetupId, setCompareSetupId] = useState(null)
  const compareSetup = setups?.find(s => s.id === compareSetupId)

  // Sweat loss
  const [useSweat, setUseSweat] = useState(false)
  const [sweatMode, setSweatMode] = useState('medium')
  const [sweatRate, setSweatRate] = useState(1.0)

  // Wind (for manual mode)
  const [windSpeed, setWindSpeed] = useState(0)
  const [windDirection, setWindDirection] = useState('headwind')

  // Route data
  const [routeData, setRouteData] = useState(null)

  const handleSweatChange = (e) => {
    const val = e.target.value
    setSweatMode(val)
    if (val === 'low') setSweatRate(0.5)
    if (val === 'medium') setSweatRate(1.0)
    if (val === 'high') setSweatRate(1.5)
  }

  // Calculate effective wind speed based on direction
  const getEffectiveWind = () => {
    if (windDirection === 'headwind') return windSpeed
    if (windDirection === 'tailwind') return -windSpeed
    return 0
  }

  const solveV = (watts, grade, m, setupCda, setupCrr, elev = 0, useWind = true) => {
    const effectiveWind = useWind && mode === 'manual' ? getEffectiveWind() : 0
    return solveVelocity(watts, grade, m, setupCda, setupCrr, rho, eff, elev, effectiveWind)
  }

  // Calculate result for a given setup's values
  const calculateResult = (setupCda, setupCrr, setupMass) => {
    if (mode === 'manual') {
      if (!useSweat) {
        const vMs = solveV(estPwr, estGrade, setupMass, setupCda, setupCrr)
        const time = vMs > 0 ? (estDist * 1000) / vMs : 0
        return { vKph: vMs * 3.6, time, loss: 0 }
      } else {
        let vMs = solveV(estPwr, estGrade, setupMass, setupCda, setupCrr)
        let t = vMs > 0 ? (estDist * 1000) / vMs : 3600

        for (let i = 0; i < 3; i++) {
          const totalLoss = sweatRate * (t / 3600)
          const avgMass = setupMass - (totalLoss / 2)
          vMs = solveV(estPwr, estGrade, avgMass, setupCda, setupCrr)
          t = vMs > 0 ? (estDist * 1000) / vMs : t
        }
        const totalLoss = sweatRate * (t / 3600)
        return { vKph: vMs * 3.6, time: t, loss: totalLoss }
      }
    } else if (routeData) {
      let totalTime = 0
      let currentMass = setupMass

      for (let i = 0; i < routeData.segments.length; i++) {
        const seg = routeData.segments[i]
        if (useSweat) {
          currentMass = Math.max(40, setupMass - (sweatRate * (totalTime / 3600)))
        }
        const v = solveV(estPwr, seg.g, currentMass, setupCda, setupCrr, seg.ele)
        if (v > 0.1) {
          totalTime += seg.d / v
        } else {
          totalTime += seg.d / 1.0
        }
      }

      const avgSpeed = (routeData.totalDist / totalTime) * 3.6
      const totalLoss = setupMass - currentMass
      return { time: totalTime, vKph: avgSpeed, loss: useSweat ? totalLoss : 0 }
    }
    return null
  }

  // Results for selected setup
  const currentRes = useMemo(() => {
    return calculateResult(cda, crr, mass)
  }, [estPwr, estGrade, estDist, cda, crr, mass, rho, eff, mode, routeData, useSweat, sweatRate, windSpeed, windDirection])

  // Results for comparison setup (only if setup has CdA/Crr values)
  const compareRes = useMemo(() => {
    if (!compareSetup || compareSetup.cda == null || compareSetup.crr == null) return null
    return calculateResult(
      compareSetup.cda,
      compareSetup.crr,
      compareSetup.mass || mass
    )
  }, [compareSetup, estPwr, estGrade, estDist, mass, rho, eff, mode, routeData, useSweat, sweatRate, windSpeed, windDirection])

  const onRouteFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = (ev) => {
      const result = parseRouteGPX(ev.target.result)
      setRouteData(result)
    }
    r.readAsText(f)
  }

  const fmtTime = (sec) => {
    if (!sec || sec === Infinity) return "--"
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`
  }

  // Sensitivity table
  const sensitivity = useMemo(() => {
    return [-20, -10, 0, 10, 20].map(delta => {
      const w = estPwr + delta
      let t = 0, s = 0

      if (mode === 'manual') {
        if (!useSweat) {
          const v = solveV(w, estGrade, mass, cda, crr)
          t = v > 0 ? (estDist * 1000) / v : 0
          s = v * 3.6
        } else {
          let v = solveV(w, estGrade, mass, cda, crr)
          t = v > 0 ? (estDist * 1000) / v : 3600
          for (let iter = 0; iter < 3; iter++) {
            const totalLoss = sweatRate * (t / 3600)
            const avgMass = mass - (totalLoss / 2)
            v = solveV(w, estGrade, avgMass, cda, crr)
            t = v > 0 ? (estDist * 1000) / v : t
          }
          s = v * 3.6
        }
      } else if (routeData) {
        let tt = 0
        let currentMass = mass
        for (let i = 0; i < routeData.segments.length; i++) {
          const seg = routeData.segments[i]
          if (useSweat) {
            currentMass = Math.max(40, mass - (sweatRate * (tt / 3600)))
          }
          const v = solveV(w, seg.g, currentMass, cda, crr, seg.ele)
          tt += seg.d / Math.max(0.5, v)
        }
        t = tt
        s = (routeData.totalDist / tt) * 3.6
      }
      return { w, kph: s, time: t }
    })
  }, [estPwr, estGrade, estDist, mass, mode, routeData, cda, crr, rho, eff, useSweat, sweatRate])

  // Time difference vs comparison
  const timeDiff = currentRes && compareRes ? compareRes.time - currentRes.time : null

  // Check if CdA/Crr values are set
  if (cda == null || crr == null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4 opacity-30">📊</div>
          <h2 className="text-xl font-bold text-white mb-2">No CdA/Crr Values</h2>
          <p className="text-gray-400 mb-4">
            This setup doesn't have CdA and Crr values yet. Run an analysis first to determine these values, then come back to estimate performance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in text-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          {/* Current Setup Info */}
          <div className="card bg-gradient-to-r from-indigo-900/30 to-dark-card border-indigo-500/30">
            <span className="text-xs text-gray-400">Estimating for</span>
            <h3 className="font-bold text-white text-lg">{selectedSetup?.name}</h3>
            <div className="flex gap-4 mt-2 text-xs font-mono">
              <span className="text-green-400">CdA: {cda.toFixed(4)}</span>
              <span className="text-blue-400">Crr: {crr.toFixed(5)}</span>
              <span className="text-gray-400">{mass}kg system</span>
            </div>
          </div>

          <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>⚡</span> Scenario
            </h2>

            <div className="flex bg-dark-input p-1 rounded mb-6 border border-dark-border">
              <button onClick={() => setMode('manual')} className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${mode === 'manual' ? 'bg-brand-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}>Manual</button>
              <button onClick={() => setMode('file')} className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${mode === 'file' ? 'bg-brand-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}>Route File</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>Target Power</span>
                  <span className="text-white font-mono">{estPwr} W</span>
                </label>
                <input type="range" min="100" max="500" step="5" value={estPwr} onChange={e => setEstPwr(parseFloat(e.target.value))} className="w-full" />
              </div>

              {mode === 'manual' ? (
                <>
                  <div>
                    <label className="flex justify-between text-sm text-gray-400 mb-1">
                      <span>Gradient</span>
                      <span className="text-white font-mono">{estGrade}%</span>
                    </label>
                    <input type="range" min="-5" max="15" step="0.5" value={estGrade} onChange={e => setEstGrade(parseFloat(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="flex justify-between text-sm text-gray-400 mb-1">
                      <span>Distance</span>
                      <span className="text-white font-mono">{estDist} km</span>
                    </label>
                    <input type="range" min="1" max="200" step="1" value={estDist} onChange={e => setEstDist(parseFloat(e.target.value))} className="w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Wind</span>
                        <span className="text-white font-mono">{windSpeed} m/s</span>
                      </label>
                      <input type="range" min="0" max="15" step="0.5" value={windSpeed} onChange={e => setWindSpeed(parseFloat(e.target.value))} className="w-full" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Direction</label>
                      <select
                        value={windDirection}
                        onChange={e => setWindDirection(e.target.value)}
                        className="input-dark w-full text-sm"
                      >
                        <option value="headwind">Headwind</option>
                        <option value="tailwind">Tailwind</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-dark-bg p-4 rounded border border-dashed border-gray-600 text-center">
                  <label className="cursor-pointer block">
                    <span className="text-brand-accent text-sm font-medium hover:underline">Upload Route GPX</span>
                    <input type="file" accept=".gpx" onChange={onRouteFile} className="hidden" />
                  </label>
                  {routeData ? (
                    <div className="mt-3 text-left text-xs space-y-1">
                      <div className="flex justify-between"><span>Distance:</span> <span className="text-white">{(routeData.totalDist / 1000).toFixed(2)} km</span></div>
                      <div className="flex justify-between"><span>Elevation:</span> <span className="text-white">{routeData.gain.toFixed(0)} m</span></div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">Select a route file</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Compare with another setup */}
          <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
            <h3 className="label-sm mb-2">Compare With</h3>
            <select
              value={compareSetupId || ''}
              onChange={e => setCompareSetupId(e.target.value || null)}
              className="input-dark w-full text-sm"
            >
              <option value="">No comparison</option>
              {setups?.filter(s => s.id !== selectedSetup?.id).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {compareSetup && (
              <div className="mt-2 text-xs font-mono text-gray-400">
                {compareSetup.cda != null && compareSetup.crr != null ? (
                  <>CdA: {compareSetup.cda.toFixed(4)} • Crr: {compareSetup.crr.toFixed(5)}</>
                ) : (
                  <span className="text-yellow-500">No CdA/Crr values set</span>
                )}
              </div>
            )}
          </div>

          {/* Weight Degradation */}
          <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💧</span> Weight Loss
              </h2>
              <button
                onClick={() => setUseSweat(!useSweat)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useSweat ? 'bg-brand-primary' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useSweat ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className={`transition-opacity duration-300 ${useSweat ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <select value={sweatMode} onChange={handleSweatChange} className="input-dark w-full text-xs py-2">
                <option value="low">Low (0.5 L/hr)</option>
                <option value="medium">Medium (1.0 L/hr)</option>
                <option value="high">High (1.5 L/hr)</option>
                <option value="custom">Custom</option>
              </select>

              {sweatMode === 'custom' && (
                <div className="mt-2">
                  <input type="number" step="0.1" value={sweatRate} onChange={e => setSweatRate(safeNum(e.target.value, sweatRate))} className="input-dark w-full" placeholder="kg/hr" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {/* Main Result */}
          <div className="bg-gradient-to-br from-indigo-900 to-dark-card p-6 rounded-xl border border-indigo-500/30 shadow-lg">
            <h3 className="text-sm uppercase text-indigo-300 mb-1">
              {mode === 'manual' ? 'Estimated Speed' : 'Predicted Avg Speed'}
            </h3>
            <div className="text-5xl font-bold text-white mb-2">
              {currentRes ? currentRes.vKph.toFixed(2) : '--'} <span className="text-xl text-indigo-300 font-normal">km/h</span>
            </div>
            <div className="h-px bg-indigo-500/30 my-4"></div>
            <h3 className="text-sm uppercase text-indigo-300 mb-1">Estimated Time</h3>
            <div className="text-3xl font-mono text-white">
              {currentRes ? fmtTime(currentRes.time) : '--'}
            </div>
            {useSweat && currentRes && currentRes.loss > 0 && (
              <div className="mt-4 pt-4 border-t border-indigo-500/20 flex justify-between items-center text-xs">
                <span className="text-indigo-200">Weight Lost:</span>
                <span className="font-mono font-bold text-white">{currentRes.loss.toFixed(2)} kg</span>
              </div>
            )}
          </div>

          {/* Comparison Result */}
          {compareSetup && compareRes && (
            <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-400">{compareSetup.name}</h3>
                {timeDiff !== null && (
                  <span className={`text-sm font-mono font-bold ${timeDiff > 0 ? 'text-green-400' : timeDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {timeDiff > 0 ? '+' : ''}{Math.round(timeDiff)}s
                  </span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Speed</span>
                <span className="font-mono">{compareRes.vKph.toFixed(2)} km/h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Time</span>
                <span className="font-mono">{fmtTime(compareRes.time)}</span>
              </div>
              {timeDiff !== null && Math.abs(timeDiff) > 1 && (
                <p className="text-xs text-gray-500 mt-2">
                  {timeDiff > 0
                    ? `${selectedSetup?.name} is ${Math.round(timeDiff)}s faster`
                    : `${compareSetup.name} is ${Math.round(Math.abs(timeDiff))}s faster`
                  }
                </p>
              )}
            </div>
          )}

          {/* Sensitivity Table */}
          <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
            <div className="px-4 py-3 bg-dark-bg border-b border-dark-border">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Power Sensitivity</h3>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 bg-dark-bg/50 uppercase">
                <tr>
                  <th className="px-4 py-2">Power</th>
                  <th className="px-4 py-2">Speed</th>
                  <th className="px-4 py-2 text-right">Time Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {sensitivity.map((row, i) => {
                  const isBase = row.w === estPwr
                  const baseTime = sensitivity[2].time
                  const saved = baseTime - row.time
                  return (
                    <tr key={i} className={isBase ? "bg-indigo-900/20" : ""}>
                      <td className={`px-4 py-2 font-mono ${isBase ? 'text-indigo-400 font-bold' : ''}`}>{row.w} W</td>
                      <td className="px-4 py-2 font-mono">{row.kph.toFixed(1)} km/h</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-400">
                        {saved === 0 ? '-' : (saved > 0 ? <span className="text-green-400">-{Math.round(saved)}s</span> : <span className="text-red-400">+{Math.round(Math.abs(saved))}s</span>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
