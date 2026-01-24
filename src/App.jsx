import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { LoginPage } from './components/auth/LoginPage'
import { UserMenu } from './components/auth/UserMenu'
import { EstimatorTab } from './components/estimator/EstimatorTab'
import { DashboardTab } from './components/dashboard/DashboardTab'
import { StudiesTab } from './components/studies/StudiesTab'
import { QuickTestTab } from './components/quicktest/QuickTestTab'
import { GuideTab } from './components/guide/GuideTab'
import { ValidationTab } from './components/validation/ValidationTab'
import { PrivacyPolicy, TermsOfService, CookieNotice } from './components/legal'
import { ContactModal } from './components/ui'

const AppContent = () => {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [legalPage, setLegalPage] = useState(null)
  const [showContact, setShowContact] = useState(false)

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
            <button
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                activeTab === 'guide'
                  ? 'bg-brand-primary/20 text-white border border-brand-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
              onClick={() => setActiveTab('guide')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Guide
            </button>
            <button
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                activeTab === 'validation'
                  ? 'bg-brand-primary/20 text-white border border-brand-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
              onClick={() => setActiveTab('validation')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Validation
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

        {/* Support section */}
        <div className="px-4 pb-4">
          <form action="https://www.paypal.com/donate" method="post" target="_blank">
            <input type="hidden" name="business" value="PJXRHYBZ4CRSA" />
            <input type="hidden" name="no_recurring" value="0" />
            <input type="hidden" name="item_name" value="All donations go toward hosting fees. Thanks for your support!" />
            <input type="hidden" name="currency_code" value="CAD" />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.27A.77.77 0 0 1 5.7 1.614h6.932c2.293 0 3.996.6 5.06 1.783.473.525.797 1.118.967 1.763.18.677.209 1.466.089 2.348-.018.13-.04.265-.066.406l-.006.034v.306l.238.137c.201.115.37.24.515.383.353.35.587.79.696 1.31.111.53.099 1.163-.036 1.88-.156.828-.438 1.543-.836 2.122-.362.527-.83.972-1.385 1.316-.535.331-1.16.584-1.856.75-.678.163-1.436.245-2.253.245h-.534c-.403 0-.793.146-1.096.41-.304.264-.497.632-.545 1.029l-.04.306-.677 4.29-.03.216c-.004.032-.013.064-.028.093a.087.087 0 0 1-.062.051H7.076z"/>
              </svg>
              Support the App
            </button>
          </form>
          <p className="text-xs text-gray-500 text-center mt-2">
            Help cover server costs
          </p>
        </div>

        {/* Contact link */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowContact(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-dark-card rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contact / Feedback
          </button>
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
          {activeTab === 'guide' && <GuideTab />}
          {activeTab === 'validation' && <ValidationTab />}
        </div>
      </div>

      {/* Cookie Notice */}
      <CookieNotice onShowPrivacy={() => setLegalPage('privacy')} />

      {/* Contact Modal */}
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
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
