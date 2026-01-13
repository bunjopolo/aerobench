import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { useSetups } from './hooks/useSetups'
import { LoginPage } from './components/auth/LoginPage'
import { UserMenu } from './components/auth/UserMenu'
import { AnalysisTab } from './components/analysis/AnalysisTab'
import { EstimatorTab } from './components/estimator/EstimatorTab'
import { SetupsTab } from './components/setups/SetupsTab'
import { DashboardTab } from './components/dashboard/DashboardTab'
import { PrivacyPolicy, TermsOfService, CookieNotice } from './components/legal'

const AppContent = () => {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { setups, loading: setupsLoading, updateSetup, createSetup, deleteSetup, refresh: refreshSetups } = useSetups()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [legalPage, setLegalPage] = useState(null)

  // App-wide selected setup
  const [selectedSetupId, setSelectedSetupId] = useState(null)
  const selectedSetup = setups.find(s => s.id === selectedSetupId)

  // Environmental settings (not tied to setup)
  const [rho, setRho] = useState(1.225)

  // Auto-select first setup when setups load
  useEffect(() => {
    if (!selectedSetupId && setups.length > 0) {
      // Prefer favorite, otherwise first setup
      const favorite = setups.find(s => s.is_favorite)
      setSelectedSetupId(favorite?.id || setups[0].id)
    }
  }, [setups, selectedSetupId])

  // Clear selection if selected setup is deleted
  useEffect(() => {
    if (selectedSetupId && setups.length > 0 && !setups.find(s => s.id === selectedSetupId)) {
      setSelectedSetupId(setups[0]?.id || null)
    }
  }, [setups, selectedSetupId])

  const loading = authLoading || setupsLoading

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

  // Show legal pages (available even when not authenticated)
  if (legalPage === 'privacy') {
    return <PrivacyPolicy onBack={() => setLegalPage(null)} />
  }
  if (legalPage === 'terms') {
    return <TermsOfService onBack={() => setLegalPage(null)} />
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onShowPrivacy={() => setLegalPage('privacy')} onShowTerms={() => setLegalPage('terms')} />
        <CookieNotice onShowPrivacy={() => setLegalPage('privacy')} />
      </>
    )
  }

  // Get physics from selected setup (preserve null for unset values)
  const physics = selectedSetup ? {
    cda: selectedSetup.cda,
    crr: selectedSetup.crr,
    mass: selectedSetup.mass || 80,
    eff: selectedSetup.drivetrain_efficiency || 0.975,
    rho,
    setRho,
    setupId: selectedSetup.id,
    setupName: selectedSetup.name
  } : null

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

        {/* Setup Selector */}
        <div className="p-4 border-b border-dark-border bg-gradient-to-b from-dark-card/50 to-transparent">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Active Setup</label>
          {setups.length > 0 ? (
            <div className="space-y-3">
              <div className="relative">
                <select
                  value={selectedSetupId || ''}
                  onChange={e => setSelectedSetupId(e.target.value)}
                  className="w-full bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border-2 border-indigo-500/50 rounded-xl px-4 py-3 text-white font-semibold text-base appearance-none cursor-pointer hover:border-indigo-400 hover:from-indigo-800/80 hover:to-purple-800/80 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                >
                  {setups.map(s => (
                    <option key={s.id} value={s.id} className="bg-dark-bg text-white">
                      {s.is_favorite ? '★ ' : ''}{s.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {/* Quick Stats */}
              {selectedSetup && (
                <div className="flex gap-2">
                  <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-center">
                    <div className="text-[9px] text-green-400/70 uppercase font-bold">CdA</div>
                    <div className="text-sm font-mono font-bold text-green-400">
                      {selectedSetup.cda != null ? selectedSetup.cda.toFixed(3) : '--'}
                    </div>
                  </div>
                  <div className="flex-1 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-center">
                    <div className="text-[9px] text-blue-400/70 uppercase font-bold">Crr</div>
                    <div className="text-sm font-mono font-bold text-blue-400">
                      {selectedSetup.crr != null ? selectedSetup.crr.toFixed(4) : '--'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-gradient-to-b from-indigo-500/5 to-transparent rounded-xl border border-dashed border-indigo-500/30">
              <div className="text-3xl mb-2 opacity-50">+</div>
              <p className="text-gray-400 text-xs mb-3">No setups configured</p>
              <button
                onClick={() => setActiveTab('setups')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Create Setup
              </button>
            </div>
          )}
        </div>

        {/* Selected Setup Details */}
        {selectedSetup && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="card">
              <div className="flex justify-between items-center mb-3">
                <h3 className="label-sm">Setup Values</h3>
                <button
                  onClick={() => setActiveTab('setups')}
                  className="text-xs text-brand-primary hover:text-indigo-400"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-400 font-medium">● CdA (Aero)</span>
                    <span className="font-mono">{selectedSetup.cda != null ? selectedSetup.cda.toFixed(4) : <span className="text-gray-500">Not set</span>}</span>
                  </div>
                  {selectedSetup.cda != null && (
                    <div className="h-1.5 bg-dark-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(selectedSetup.cda - 0.15) / 0.35 * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-blue-400 font-medium">● Crr (Roll)</span>
                    <span className="font-mono">{selectedSetup.crr != null ? selectedSetup.crr.toFixed(5) : <span className="text-gray-500">Not set</span>}</span>
                  </div>
                  {selectedSetup.crr != null && (
                    <div className="h-1.5 bg-dark-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(selectedSetup.crr - 0.002) / 0.01 * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-dark-border">
                <div>
                  <span className="text-[10px] text-gray-500 block">System Mass</span>
                  <span className="font-mono text-sm">{selectedSetup.mass || 80} kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Efficiency</span>
                  <span className="font-mono text-sm text-brand-accent">
                    {((selectedSetup.drivetrain_efficiency || 0.975) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {selectedSetup.bike_name && (
                <div className="mt-3 pt-3 border-t border-dark-border">
                  <span className="text-[10px] text-gray-500 block">Bike</span>
                  <span className="text-sm text-gray-300">{selectedSetup.bike_name}</span>
                </div>
              )}
            </div>

            {/* Environment Settings */}
            <div className="card">
              <h3 className="label-sm mb-3">Environment</h3>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Air Density (kg/m³)</label>
                <input
                  type="number"
                  step="0.001"
                  value={rho}
                  onChange={e => setRho(parseFloat(e.target.value) || 1.225)}
                  className="input-dark w-full"
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Sea level ~1.225 • 1000m ~1.112 • 2000m ~1.007
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Links */}
        <div className="p-4 border-t border-dark-border">
          <div className="flex justify-center gap-4 text-xs text-gray-500">
            <button onClick={() => setLegalPage('privacy')} className="hover:text-gray-300 transition-colors">
              Privacy
            </button>
            <span>·</span>
            <button onClick={() => setLegalPage('terms')} className="hover:text-gray-300 transition-colors">
              Terms
            </button>
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
          {activeTab === 'dashboard' && <DashboardTab physics={physics} setups={setups} />}
          {activeTab === 'analysis' && (
            physics ? (
              <AnalysisTab
                physics={physics}
                selectedSetup={selectedSetup}
                onUpdateSetup={updateSetup}
              />
            ) : (
              <NoSetupPrompt onCreateSetup={() => setActiveTab('setups')} />
            )
          )}
          {activeTab === 'estimator' && (
            physics ? (
              <EstimatorTab
                physics={physics}
                selectedSetup={selectedSetup}
                setups={setups}
                onSelectSetup={setSelectedSetupId}
              />
            ) : (
              <NoSetupPrompt onCreateSetup={() => setActiveTab('setups')} />
            )
          )}
          {activeTab === 'setups' && (
            <SetupsTab
              selectedSetupId={selectedSetupId}
              onSelectSetup={setSelectedSetupId}
              setups={setups}
              loading={setupsLoading}
              createSetup={createSetup}
              updateSetup={updateSetup}
              deleteSetup={deleteSetup}
              refresh={refreshSetups}
            />
          )}
        </div>
      </div>

      {/* Cookie Notice */}
      <CookieNotice onShowPrivacy={() => setLegalPage('privacy')} />
    </div>
  )
}

// Prompt shown when no setup is selected
const NoSetupPrompt = ({ onCreateSetup }) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="text-6xl mb-4 opacity-30">🚴</div>
      <h2 className="text-xl font-bold text-white mb-2">No Setup Selected</h2>
      <p className="text-gray-400 mb-6">Create an equipment setup to start analyzing your aerodynamics</p>
      <button onClick={onCreateSetup} className="btn-primary">
        Create Your First Setup
      </button>
    </div>
  </div>
)

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
