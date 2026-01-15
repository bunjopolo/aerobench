import { useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth.jsx'
import { parseRouteGPX } from '../../lib/gpxParser'
import { solveVelocity, safeNum } from '../../lib/physics'

export const EstimatorTab = () => {
  const { user } = useAuth()

  // Physics inputs (user-configurable)
  const [cda, setCda] = useState(0.25)
  const [crr, setCrr] = useState(0.004)
  const [mass, setMass] = useState(80)
  const [eff, setEff] = useState(0.97)
  const [rho, setRho] = useState(1.225)

  const [mode, setMode] = useState('manual')
  const [estPwr, setEstPwr] = useState(250)
  const [estGrade, setEstGrade] = useState(0)
  const [estDist, setEstDist] = useState(40)

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

  // Calculate result for given values
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

  // Results for current values
  const currentRes = useMemo(() => {
    return calculateResult(cda, crr, mass)
  }, [estPwr, estGrade, estDist, cda, crr, mass, rho, eff, mode, routeData, useSweat, sweatRate, windSpeed, windDirection])

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

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please sign in to use the estimator</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Speed Estimator</h2>
        <p className="text-gray-400 text-sm">Predict performance based on your aerodynamic values</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Physics Inputs */}
        <div className="space-y-4">
          <div className="bg-dark-card p-5 rounded-xl border border-dark-border">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Physics Values</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CdA (m²)</label>
                <input
                  type="number"
                  step="0.001"
                  value={cda}
                  onChange={e => setCda(safeNum(e.target.value, cda))}
                  className="input-dark w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Crr</label>
                <input
                  type="number"
                  step="0.0001"
                  value={crr}
                  onChange={e => setCrr(safeNum(e.target.value, crr))}
                  className="input-dark w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">System Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={mass}
                  onChange={e => setMass(safeNum(e.target.value, mass))}
                  className="input-dark w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Drivetrain Efficiency</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.8"
                  max="1"
                  value={eff}
                  onChange={e => setEff(safeNum(e.target.value, eff))}
                  className="input-dark w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Air Density (kg/m³)</label>
                <input
                  type="number"
                  step="0.001"
                  value={rho}
                  onChange={e => setRho(safeNum(e.target.value, rho))}
                  className="input-dark w-full text-sm"
                />
              </div>
            </div>
          </div>

          {/* Weight Loss */}
          <div className="bg-dark-card p-5 rounded-xl border border-dark-border">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase">Weight Loss</h3>
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

        {/* Scenario Inputs */}
        <div className="space-y-4">
          <div className="bg-dark-card p-5 rounded-xl border border-dark-border">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Scenario</h3>

            <div className="flex bg-dark-input p-1 rounded mb-4 border border-dark-border">
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
        </div>

        {/* Results */}
        <div className="space-y-4">
          {/* Main Result */}
          <div className="bg-gradient-to-br from-indigo-900 to-dark-card p-6 rounded-xl border border-indigo-500/30 shadow-lg">
            <h3 className="text-sm uppercase text-indigo-300 mb-1">
              {mode === 'manual' ? 'Estimated Speed' : 'Predicted Avg Speed'}
            </h3>
            <div className="text-4xl font-bold text-white mb-2">
              {currentRes ? currentRes.vKph.toFixed(2) : '--'} <span className="text-lg text-indigo-300 font-normal">km/h</span>
            </div>
            <div className="h-px bg-indigo-500/30 my-3"></div>
            <h3 className="text-sm uppercase text-indigo-300 mb-1">Estimated Time</h3>
            <div className="text-2xl font-mono text-white">
              {currentRes ? fmtTime(currentRes.time) : '--'}
            </div>
            {useSweat && currentRes && currentRes.loss > 0 && (
              <div className="mt-3 pt-3 border-t border-indigo-500/20 flex justify-between items-center text-xs">
                <span className="text-indigo-200">Weight Lost:</span>
                <span className="font-mono font-bold text-white">{currentRes.loss.toFixed(2)} kg</span>
              </div>
            )}
          </div>

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
