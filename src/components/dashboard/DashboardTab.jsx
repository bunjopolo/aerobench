import { useAuth } from '../../hooks/useAuth.jsx'
import { useStudies } from '../../hooks/useStudies'
import { getVariableType } from '../../lib/variableTypes'

export const DashboardTab = ({ onStudyClick }) => {
  const { user, signInWithGoogle } = useAuth()
  const { studies, loading: studiesLoading } = useStudies()

  // Landing page for unauthenticated users
  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/20 rounded-2xl mb-6">
            <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Measure Your Aerodynamics
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            AeroBench uses virtual elevation analysis to calculate your CdA and Crr from regular training rides. No wind tunnel required.
          </p>

          {/* Sign In Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <button
              onClick={signInWithGoogle}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Virtual Elevation</h3>
            <p className="text-sm text-gray-400">
              Upload GPX files from your rides and calculate CdA and Crr using the Chung method.
            </p>
          </div>

          <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Compare Equipment</h3>
            <p className="text-sm text-gray-400">
              Test different positions, tires, and equipment to find measurable aero gains.
            </p>
          </div>

          <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Speed Estimator</h3>
            <p className="text-sm text-gray-400">
              Predict race times and speeds using your measured aerodynamic values.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-dark-card rounded-xl border border-dark-border p-8">
          <h2 className="text-xl font-bold text-white mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold mx-auto mb-3">1</div>
              <h4 className="font-medium text-white mb-2">Record Your Ride</h4>
              <p className="text-sm text-gray-500">Do a steady-effort ride on a flat or rolling course with your power meter.</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold mx-auto mb-3">2</div>
              <h4 className="font-medium text-white mb-2">Upload Your GPX</h4>
              <p className="text-sm text-gray-500">Export from Strava, Garmin, or Wahoo and upload to AeroBench.</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold mx-auto mb-3">3</div>
              <h4 className="font-medium text-white mb-2">Get Your Results</h4>
              <p className="text-sm text-gray-500">See your CdA and Crr values, compare setups, and track improvements.</p>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            Free to use. Create an account to save your data.
          </p>
        </div>
      </div>
    )
  }

  if (studiesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  const allStudies = studies || []
  const averagingStudies = allStudies.filter(s => s.study_mode === 'averaging')
  const comparisonStudies = allStudies.filter(s => s.study_mode !== 'averaging')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 text-sm">Overview of your aerodynamic testing</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Studies</div>
          <div className="text-3xl font-bold text-white">{allStudies.length}</div>
        </div>
        <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Averaging Studies</div>
          <div className="text-3xl font-bold text-blue-400">{averagingStudies.length}</div>
          <p className="text-xs text-gray-500 mt-1">Baseline establishment</p>
        </div>
        <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Comparison Studies</div>
          <div className="text-3xl font-bold text-green-400">{comparisonStudies.length}</div>
          <p className="text-xs text-gray-500 mt-1">Equipment A/B tests</p>
        </div>
      </div>

      {/* Recent Studies */}
      {allStudies.length > 0 ? (
        <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Recent Studies</h3>
          <div className="space-y-3">
            {allStudies.slice(0, 5).map(study => {
              const varType = getVariableType(study.variable_type)
              const isAveraging = study.study_mode === 'averaging'
              return (
                <button
                  key={study.id}
                  onClick={() => onStudyClick?.(study.id)}
                  className="w-full flex items-center justify-between p-4 bg-dark-bg rounded-lg border border-dark-border hover:border-brand-primary/50 transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white truncate">{study.name}</h4>
                      <span className={`text-xxs px-2 py-0.5 rounded ${
                        isAveraging ? 'bg-blue-900/30 text-blue-400' : 'bg-dark-card text-gray-400'
                      }`}>
                        {isAveraging ? 'Averaging' : varType.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span>{study.mass}kg</span>
                      {!isAveraging && <span>{study.variation_count || 0} configurations</span>}
                      <span>{new Date(study.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-dark-card p-12 rounded-xl border border-dark-border text-center">
          <h3 className="text-lg font-medium text-white mb-2">No studies yet</h3>
          <p className="text-gray-400 mb-4">Create your first study to start analyzing your aerodynamics</p>
          <p className="text-sm text-gray-500">
            Go to the Studies tab to get started
          </p>
        </div>
      )}

    </div>
  )
}
