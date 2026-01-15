import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { LoginPage } from './components/auth/LoginPage'
import { UserMenu } from './components/auth/UserMenu'
import { EstimatorTab } from './components/estimator/EstimatorTab'
import { DashboardTab } from './components/dashboard/DashboardTab'
import { StudiesTab } from './components/studies/StudiesTab'
import { QuickTestTab } from './components/quicktest/QuickTestTab'
import { PrivacyPolicy, TermsOfService, CookieNotice } from './components/legal'

const AppContent = () => {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [legalPage, setLegalPage] = useState(null)

  if (authLoading) {
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

  return (
    <div className="flex h-screen overflow-hidden text-sm">
      {/* SIDEBAR */}
      <div className="w-64 flex-shrink-0 bg-dark-bg border-r border-dark-border flex flex-col z-20 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              AeroBench
            </h1>
            <UserMenu />
          </div>
          <p className="text-xs text-gray-500 mt-1">Virtual Elevation Analysis</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <button
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                activeTab === 'dashboard'
                  ? 'bg-brand-primary/20 text-white border border-brand-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
              onClick={() => setActiveTab('dashboard')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Dashboard
            </button>
            <button
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                activeTab === 'studies'
                  ? 'bg-brand-primary/20 text-white border border-brand-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
              onClick={() => setActiveTab('studies')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Studies
            </button>
            <button
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                activeTab === 'quicktest'
                  ? 'bg-brand-primary/20 text-white border border-brand-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
              onClick={() => setActiveTab('quicktest')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Test
            </button>
            <button
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                activeTab === 'estimator'
                  ? 'bg-brand-primary/20 text-white border border-brand-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
              onClick={() => setActiveTab('estimator')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Estimator
            </button>
          </div>
        </nav>

        {/* Help section */}
        <div className="p-4 border-t border-dark-border">
          <div className="bg-dark-card rounded-lg p-3">
            <h4 className="text-xs font-medium text-white mb-1">Getting Started</h4>
            <p className="text-xs text-gray-500">
              Create a study to analyze your aerodynamics from GPX files.
            </p>
          </div>
        </div>

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
        {/* Content Area */}
        <div className="flex-1 relative overflow-auto">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'studies' && <StudiesTab />}
          {activeTab === 'quicktest' && <QuickTestTab />}
          {activeTab === 'estimator' && <EstimatorTab />}
        </div>
      </div>

      {/* Cookie Notice */}
      <CookieNotice onShowPrivacy={() => setLegalPage('privacy')} />
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
