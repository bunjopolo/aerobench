import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { LoginPage } from './components/auth/LoginPage'
import { UserMenu } from './components/auth/UserMenu'
import { AnalysisTab } from './components/analysis/AnalysisTab'
import { EstimatorTab } from './components/estimator/EstimatorTab'
import { SetupsTab } from './components/setups/SetupsTab'
import { DashboardTab } from './components/dashboard/DashboardTab'
import { CHAIN_DATA } from './lib/physics'

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('analysis')

  // Global physics state (shared across tabs)
  const [cda, setCda] = useState(0.320)
  const [crr, setCrr] = useState(0.0040)
  const [mass, setMass] = useState(85.0)
  const [eff, setEff] = useState(0.975)
  const [rho, setRho] = useState(1.225)
  const [chain, setChain] = useState("Custom (Waxed)")

  // Update efficiency when chain changes
  const handleChainChange = (newChain) => {
    setChain(newChain)
    if (CHAIN_DATA[newChain]) {
      setEff(CHAIN_DATA[newChain])
    }
  }

  // Load a setup's values into the global state
  const loadSetup = (setup) => {
    if (setup.cda) setCda(setup.cda)
    if (setup.crr) setCrr(setup.crr)
    if (setup.mass) setMass(setup.mass)
    if (setup.drivetrain_efficiency) setEff(setup.drivetrain_efficiency)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const physics = { cda, setCda, crr, setCrr, mass, setMass, eff, setEff, rho, setRho, chain, setChain: handleChainChange }

  return (
    <div className="flex h-screen overflow-hidden text-sm">
      {/* SIDEBAR */}
      <div className="w-80 flex-shrink-0 bg-dark-bg border-r border-dark-border flex flex-col z-20 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🚴</span> AeroBench
            </h1>
            <UserMenu />
          </div>
        </div>

        {/* Global Physics Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="card">
            <h3 className="label-sm mb-2">Global Physics</h3>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Air Density</label>
                <input
                  type="number"
                  step="0.001"
                  value={rho}
                  onChange={e => setRho(parseFloat(e.target.value) || rho)}
                  className="input-dark w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Mass (kg)</label>
                <input
                  type="number"
                  value={mass}
                  onChange={e => setMass(parseFloat(e.target.value) || mass)}
                  className="input-dark w-full"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-green-400 font-medium">● CdA (Aero)</span>
                  <span className="font-mono">{cda.toFixed(5)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.00001"
                  value={cda}
                  onChange={e => setCda(parseFloat(e.target.value))}
                  className="slider-cda"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-400 font-medium">● Crr (Roll)</span>
                  <span className="font-mono">{crr.toFixed(5)}</span>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="0.015"
                  step="0.00001"
                  value={crr}
                  onChange={e => setCrr(parseFloat(e.target.value))}
                  className="slider-crr"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="label-sm mb-3">Drivetrain Loss</h3>
            <select
              value={chain}
              onChange={e => handleChainChange(e.target.value)}
              className="input-dark w-full text-xs"
            >
              {Object.keys(CHAIN_DATA).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <div className="mt-3 flex justify-between items-center text-xs">
              <span className="text-gray-400">Total Efficiency</span>
              <span className="text-brand-accent font-mono font-bold">{(eff * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-dark-bg">
        {/* Tab Bar */}
        <div className="bg-dark-bg border-b border-dark-border flex items-center px-6 gap-6 z-10">
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            Analysis
          </button>
          <button
            className={`tab-btn ${activeTab === 'estimator' ? 'active' : ''}`}
            onClick={() => setActiveTab('estimator')}
          >
            Estimator
          </button>
          <button
            className={`tab-btn ${activeTab === 'setups' ? 'active' : ''}`}
            onClick={() => setActiveTab('setups')}
          >
            My Setups
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-auto">
          {activeTab === 'dashboard' && <DashboardTab physics={physics} />}
          {activeTab === 'analysis' && <AnalysisTab physics={physics} />}
          {activeTab === 'estimator' && <EstimatorTab physics={physics} />}
          {activeTab === 'setups' && <SetupsTab physics={physics} onLoadSetup={loadSetup} />}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
