import { useAuth } from '../../hooks/useAuth.jsx'
import { useStudies } from '../../hooks/useStudies'
import { getVariableType } from '../../lib/variableTypes'

export const DashboardTab = () => {
  const { user } = useAuth()
  const { studies, loading: studiesLoading } = useStudies()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please sign in to view dashboard</p>
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
                <div
                  key={study.id}
                  className="flex items-center justify-between p-4 bg-dark-bg rounded-lg border border-dark-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white truncate">{study.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
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
                </div>
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

      {/* Tips */}
      <div className="bg-gradient-to-r from-indigo-900/20 to-dark-card p-6 rounded-xl border border-indigo-500/30">
        <h3 className="text-sm font-bold text-indigo-400 uppercase mb-3">Tips for Accurate Results</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">1.</span>
            Use flat, out-and-back courses for best accuracy
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">2.</span>
            Aim for 3-5 runs per configuration to get reliable averages
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">3.</span>
            Test in calm wind conditions when possible
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">4.</span>
            Make sure your power meter is calibrated before testing
          </li>
        </ul>
      </div>
    </div>
  )
}
