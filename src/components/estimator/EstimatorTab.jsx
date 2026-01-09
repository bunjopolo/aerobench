import { useState, useMemo } from 'react'
import { parseRouteGPX } from '../../lib/gpxParser'
import { GRAVITY, solveVelocity, safeNum } from '../../lib/physics'
import { useSetups } from '../../hooks/useSetups'

export const EstimatorTab = ({ physics }) => {
  const { cda: globalCda, crr: globalCrr, mass: globalMass, rho, eff } = physics
  const { setups } = useSetups()

  // Setup selection
  const [selectedSetupId, setSelectedSetupId] = useState(null)
  const selectedSetup = setups.find(s => s.id === selectedSetupId)

  // Use setup values if selected, otherwise use global physics
  const cda = selectedSetup?.cda || globalCda
  const crr = selectedSetup?.crr || globalCrr
  const mass = selectedSetup?.mass || globalMass

  const [mode, setMode] = useState('manual')
  const [estPwr, setEstPwr] = useState(250)
  const [estGrade, setEstGrade] = useState(0)
  const [estDist, setEstDist] = useState(40)

  // Sweat loss
  const [useSweat, setUseSweat] = useState(false)
  const [sweatMode, setSweatMode] = useState('medium')
  const [sweatRate, setSweatRate] = useState(1.0)

  // Dynamic rho
  const [useDynamicRho, setUseDynamicRho] = useState(true)

  // Route data
  const [routeData, setRouteData] = useState(null)

  const handleSweatChange = (e) => {
    const val = e.target.value
    setSweatMode(val)
    if (val === 'low') setSweatRate(0.5)
    if (val === 'medium') setSweatRate(1.0)
    if (val === 'high') setSweatRate(1.5)
  }

  const solveV = (watts, grade, m, elev) => {
    return solveVelocity(watts, grade, m, cda, crr, rho, eff, elev, useDynamicRho)
  }

  // Manual results
  const manualRes = useMemo(() => {
    if (mode !== 'manual') return null

    if (!useSweat) {
      const vMs = solveV(estPwr, estGrade, mass)
      const time = vMs > 0 ? (estDist * 1000) / vMs : 0
      return { vKph: vMs * 3.6, time, loss: 0 }
    } else {
      let vMs = solveV(estPwr, estGrade, mass)
      let t = vMs > 0 ? (estDist * 1000) / vMs : 3600

      for (let i = 0; i < 3; i++) {
        const totalLoss = sweatRate * (t / 3600)
        const avgMass = mass - (totalLoss / 2)
        vMs = solveV(estPwr, estGrade, avgMass)
        t = vMs > 0 ? (estDist * 1000) / vMs : t
      }
      const totalLoss = sweatRate * (t / 3600)
      return { vKph: vMs * 3.6, time: t, loss: totalLoss }
    }
  }, [estPwr, estGrade, estDist, cda, crr, mass, rho, eff, mode, useSweat, sweatRate, useDynamicRho])

  // Route results
  const routeRes = useMemo(() => {
    if (mode !== 'file' || !routeData) return null

    let totalTime = 0
    let currentMass = mass

    for (let i = 0; i < routeData.segments.length; i++) {
      const seg = routeData.segments[i]
      if (useSweat) {
        currentMass = Math.max(40, mass - (sweatRate * (totalTime / 3600)))
      }
      const v = solveV(estPwr, seg.g, currentMass, seg.ele)
      if (v > 0.1) {
        totalTime += seg.d / v
      } else {
        totalTime += seg.d / 1.0
      }
    }

    const avgSpeed = (routeData.totalDist / totalTime) * 3.6
    const totalLoss = mass - currentMass
    return { time: totalTime, vKph: avgSpeed, loss: useSweat ? totalLoss : 0 }
  }, [estPwr, routeData, cda, crr, mass, rho, eff, mode, useSweat, sweatRate, useDynamicRho])

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

  const currentRes = mode === 'manual' ? manualRes : routeRes

  // Sensitivity table
  const sensitivity = useMemo(() => {
    return [-20, -10, 0, 10, 20].map(delta => {
      const w = estPwr + delta
      let t = 0, s = 0

      if (mode === 'manual') {
        if (!useSweat) {
          const v = solveV(w, estGrade, mass)
          t = v > 0 ? (estDist * 1000) / v : 0
          s = v * 3.6
        } else {
          let v = solveV(w, estGrade, mass)
          t = v > 0 ? (estDist * 1000) / v : 3600
          for (let iter = 0; iter < 3; iter++) {
            const totalLoss = sweatRate * (t / 3600)
            const avgMass = mass - (totalLoss / 2)
            v = solveV(w, estGrade, avgMass)
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
          const v = solveV(w, seg.g, currentMass, seg.ele)
          tt += seg.d / Math.max(0.5, v)
        }
        t = tt
        s = (routeData.totalDist / tt) * 3.6
      }
      return { w, kph: s, time: t }
    })
  }, [estPwr, estGrade, estDist, mass, mode, routeData, cda, crr, rho, eff, useDynamicRho, useSweat, sweatRate])

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in text-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          {/* Setup Selector */}
          <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Equipment Setup</h3>
            <select
              value={selectedSetupId || ''}
              onChange={e => setSelectedSetupId(e.target.value || null)}
              className="input-dark w-full text-sm"
            >
              <option value="">Use Global Physics (Sidebar)</option>
              {setups.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {selectedSetup && (
              <div className="mt-3 p-3 bg-dark-bg rounded border border-dark-border">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 block">CdA</span>
                    <span className="text-green-400 font-mono font-bold">{(selectedSetup.cda || 0).toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Crr</span>
                    <span className="text-blue-400 font-mono font-bold">{(selectedSetup.crr || 0).toFixed(5)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Mass</span>
                    <span className="text-gray-300 font-mono font-bold">{selectedSetup.mass || globalMass} kg</span>
                  </div>
                </div>
                {selectedSetup.bike_name && (
                  <div className="mt-2 pt-2 border-t border-dark-border text-xs text-gray-500">
                    {selectedSetup.bike_name}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>⚡</span> Scenario Inputs
            </h2>

            <div className="flex bg-dark-input p-1 rounded mb-6 border border-dark-border">
              <button onClick={() => setMode('manual')} className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${mode === 'manual' ? 'bg-brand-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}>Manual Input</button>
              <button onClick={() => setMode('file')} className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${mode === 'file' ? 'bg-brand-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}>Route File</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>Target Average Power</span>
                  <span className="text-white font-mono">{estPwr} W</span>
                </label>
                <input type="range" min="100" max="500" step="5" value={estPwr} onChange={e => setEstPwr(parseFloat(e.target.value))} className="w-full" />
              </div>

              {mode === 'manual' ? (
                <>
                  <div>
                    <label className="flex justify-between text-sm text-gray-400 mb-1">
                      <span>Road Gradient</span>
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
                      <div className="flex justify-between"><span>Elev Gain:</span> <span className="text-white">{routeData.gain.toFixed(0)} m</span></div>
                      <div className="flex justify-between"><span>Points:</span> <span className="text-gray-400">{routeData.segments.length}</span></div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">Select a route file</p>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Dynamic Air Density</span>
                    <button
                      onClick={() => setUseDynamicRho(!useDynamicRho)}
                      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${useDynamicRho ? 'bg-brand-primary' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${useDynamicRho ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-dark-border text-xs text-gray-500">
              <p className="mb-2 uppercase tracking-wide">
                Active Physics {selectedSetup ? `(${selectedSetup.name})` : '(Global)'}
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-gray-400">
                <div>CdA: <span className="text-green-400">{cda.toFixed(4)}</span></div>
                <div>Crr: <span className="text-blue-400">{crr.toFixed(5)}</span></div>
                <div>Mass: <span className="text-gray-300">{mass}kg</span></div>
                <div>Rho: <span className="text-gray-300">{rho.toFixed(3)}</span></div>
              </div>
            </div>
          </div>

          {/* Weight Degradation */}
          <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💧</span> Weight Degradation
              </h2>
              <button
                onClick={() => setUseSweat(!useSweat)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useSweat ? 'bg-brand-primary' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useSweat ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className={`transition-opacity duration-300 ${useSweat ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="mb-3">
                <label className="text-xs text-gray-400 block mb-1">Net Weight Loss Rate</label>
                <select value={sweatMode} onChange={handleSweatChange} className="input-dark w-full text-xs py-2">
                  <option value="low">Low (0.5 L/hr)</option>
                  <option value="medium">Medium (1.0 L/hr)</option>
                  <option value="high">High (1.5 L/hr)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {sweatMode === 'custom' && (
                <div className="mb-2 animate-fade-in">
                  <label className="text-[10px] text-gray-500 block mb-1">Custom Rate (kg/hr)</label>
                  <input type="number" step="0.1" value={sweatRate} onChange={e => setSweatRate(safeNum(e.target.value, sweatRate))} className="input-dark w-full" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
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

          <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
            <div className="px-4 py-3 bg-dark-bg border-b border-dark-border">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Power Sensitivity</h3>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 bg-dark-bg/50 uppercase">
                <tr>
                  <th className="px-4 py-2">Power</th>
                  <th className="px-4 py-2">Speed</th>
                  <th className="px-4 py-2 text-right">Time Saved</th>
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
