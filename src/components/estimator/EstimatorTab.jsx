import { useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth.jsx'
import { parseRouteGPX } from '../../lib/gpxParser'
import { solveVelocity, simulateRoute, safeNum } from '../../lib/physics'
import { calculateAirDensity } from '../../lib/airDensity'
import { PresetSelector } from '../presets'

export const EstimatorTab = ({ presetsHook }) => {
  const { user } = useAuth()

  // Physics inputs (user-configurable)
  const [cda, setCda] = useState(0.25)
  const [crr, setCrr] = useState(0.004)
  const [mass, setMass] = useState(80)
  const [eff, setEff] = useState(0.97)
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

  const handleLoadPreset = (preset) => {
    if (preset.cda != null) setCda(preset.cda)
    if (preset.crr != null) setCrr(preset.crr)
    if (preset.mass != null) setMass(preset.mass)
    if (preset.efficiency != null) setEff(preset.efficiency)
    if (preset.rho != null) setRho(preset.rho)
  }

  const [mode, setMode] = useState('manual')
  const [estPwr, setEstPwr] = useState(250)
  const [estGrade, setEstGrade] = useState(0)
  const [estDist, setEstDist] = useState(40)

  // Wind (for manual mode)
  const [windSpeed, setWindSpeed] = useState(0)
  const [windDirection, setWindDirection] = useState('headwind')

  // Wind (for route mode)
  const [routeWindSpeed, setRouteWindSpeed] = useState(0)
  const [routeWindDir, setRouteWindDir] = useState(0) // degrees, 0=North

  // Rider behavior settings (for route mode)
  const [coastSpeed, setCoastSpeed] = useState(45) // km/h - coast above this
  const [maxDescentSpeed, setMaxDescentSpeed] = useState(70) // km/h - brake above this
  const [minClimbSpeed, setMinClimbSpeed] = useState(5) // km/h - minimum speed

  // Route data
  const [routeData, setRouteData] = useState(null)

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
      const vMs = solveV(estPwr, estGrade, setupMass, setupCda, setupCrr)
      const time = vMs > 0 ? (estDist * 1000) / vMs : 0
      return { vKph: vMs * 3.6, time }
    } else if (routeData) {
      // Use time-step simulation for realistic route estimation
      const result = simulateRoute(routeData, {
        power: estPwr,
        mass: setupMass,
        cda: setupCda,
        crr: setupCrr,
        rho: rho,
        eff: eff,
        windSpeed: routeWindSpeed,
        windDir: routeWindDir,
        options: {
          coastSpeed: coastSpeed / 3.6,        // Convert km/h to m/s
          maxDescentSpeed: maxDescentSpeed / 3.6,
          minClimbSpeed: minClimbSpeed / 3.6
        }
      })

      return {
        time: result.time,
        vKph: result.avgSpeed * 3.6,
        maxSpeed: result.maxSpeed * 3.6,
        coastingTime: result.coastingTime,
        coastingPercent: result.coastingPercent
      }
    }
    return null
  }

  // Results for current values
  const currentRes = useMemo(() => {
    return calculateResult(cda, crr, mass)
  }, [estPwr, estGrade, estDist, cda, crr, mass, rho, eff, mode, routeData, windSpeed, windDirection, routeWindSpeed, routeWindDir, coastSpeed, maxDescentSpeed, minClimbSpeed])

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
        const v = solveV(w, estGrade, mass, cda, crr)
        t = v > 0 ? (estDist * 1000) / v : 0
        s = v * 3.6
      } else if (routeData) {
        // Use time-step simulation for sensitivity
        const result = simulateRoute(routeData, {
          power: w,
          mass: mass,
          cda: cda,
          crr: crr,
          rho: rho,
          eff: eff,
          windSpeed: routeWindSpeed,
          windDir: routeWindDir,
          options: {
            coastSpeed: coastSpeed / 3.6,
            maxDescentSpeed: maxDescentSpeed / 3.6,
            minClimbSpeed: minClimbSpeed / 3.6
          }
        })
        t = result.time
        s = result.avgSpeed * 3.6
      }
      return { w, kph: s, time: t }
    })
  }, [estPwr, estGrade, estDist, mass, mode, routeData, cda, crr, rho, eff, routeWindSpeed, routeWindDir, coastSpeed, maxDescentSpeed, minClimbSpeed])

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

            {/* Preset Selector */}
            {presetsHook && (
              <div className="mb-4">
                <PresetSelector
                  presets={presetsHook.presets}
                  loading={presetsHook.loading}
                  onLoad={handleLoadPreset}
                  onDelete={presetsHook.deletePreset}
                />
              </div>
            )}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">Air Density (kg/m³)</label>
                  <button
                    onClick={() => setShowRhoCalc(!showRhoCalc)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    {showRhoCalc ? 'Hide' : 'Calculator'}
                  </button>
                </div>
                <input
                  type="number"
                  step="0.001"
                  value={rho}
                  onChange={e => setRho(safeNum(e.target.value, rho))}
                  className="input-dark w-full text-sm"
                />

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
                <>
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

                  {/* Wind for route */}
                  <div className="pt-3 border-t border-dark-border mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="flex justify-between text-sm text-gray-400 mb-1">
                          <span>Wind</span>
                          <span className="text-white font-mono">{routeWindSpeed} m/s</span>
                        </label>
                        <input type="range" min="0" max="15" step="0.5" value={routeWindSpeed} onChange={e => setRouteWindSpeed(parseFloat(e.target.value))} className="w-full" />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">From</label>
                        <select
                          value={routeWindDir}
                          onChange={e => setRouteWindDir(parseFloat(e.target.value))}
                          className="input-dark w-full text-sm"
                        >
                          <option value="0">N (0°)</option>
                          <option value="45">NE (45°)</option>
                          <option value="90">E (90°)</option>
                          <option value="135">SE (135°)</option>
                          <option value="180">S (180°)</option>
                          <option value="225">SW (225°)</option>
                          <option value="270">W (270°)</option>
                          <option value="315">NW (315°)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rider Behavior - only show in route mode */}
          {mode === 'file' && (
            <div className="bg-dark-card p-5 rounded-xl border border-dark-border">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Rider Behavior</h3>
              <div className="space-y-3">
                <div>
                  <label className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Coast Above</span>
                    <span className="text-white font-mono">{coastSpeed} km/h</span>
                  </label>
                  <input type="range" min="30" max="60" step="1" value={coastSpeed} onChange={e => setCoastSpeed(parseFloat(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-500 mt-1">Stop pedaling when speed exceeds this</p>
                </div>
                <div>
                  <label className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Max Descent</span>
                    <span className="text-white font-mono">{maxDescentSpeed} km/h</span>
                  </label>
                  <input type="range" min="50" max="90" step="1" value={maxDescentSpeed} onChange={e => setMaxDescentSpeed(parseFloat(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-500 mt-1">Brake to stay below this speed</p>
                </div>
                <div>
                  <label className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Min Climb</span>
                    <span className="text-white font-mono">{minClimbSpeed} km/h</span>
                  </label>
                  <input type="range" min="3" max="10" step="0.5" value={minClimbSpeed} onChange={e => setMinClimbSpeed(parseFloat(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-500 mt-1">Minimum speed on steep climbs</p>
                </div>
              </div>
            </div>
          )}
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
            {/* Route simulation stats */}
            {mode === 'file' && currentRes && currentRes.maxSpeed && (
              <div className="mt-3 pt-3 border-t border-indigo-500/20 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-200">Max Speed:</span>
                  <span className="font-mono font-bold text-white">{currentRes.maxSpeed.toFixed(1)} km/h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-200">Coasting:</span>
                  <span className="font-mono text-white">{fmtTime(currentRes.coastingTime)} ({currentRes.coastingPercent.toFixed(1)}%)</span>
                </div>
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
