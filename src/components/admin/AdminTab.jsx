import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'

// Admin email - set in environment variable for security
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

// Feature descriptions for the UI
const FEATURE_INFO = {
  method_shen: {
    name: 'Shen Method',
    description: 'Dual-acceleration method for separating CdA and Crr using slow/fast acceleration runs',
    color: 'amber'
  },
  method_climb: {
    name: 'Climb Method',
    description: 'Uses low and high speed runs on the same climb to separate CdA and Crr',
    color: 'emerald'
  },
  method_sweep: {
    name: 'Sweep Method',
    description: '2D parameter sweep showing all possible CdA/Crr solutions and their degeneracy',
    color: 'violet'
  }
}

export const AdminTab = () => {
  const { user } = useAuth()
  const { flags, updateFlag } = useFeatureFlags()
  const [flagUpdating, setFlagUpdating] = useState(null)

  // Check if user is admin
  const isAdmin = user?.email === ADMIN_EMAIL

  // Handle feature flag toggle
  const handleToggleFlag = async (featureKey) => {
    setFlagUpdating(featureKey)
    const newValue = !flags[featureKey]
    await updateFlag(featureKey, newValue)
    setFlagUpdating(null)
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-500">This page is only accessible to administrators.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Manage feature flags and app settings</p>
      </div>

      {/* Feature Flags */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Feature Flags</h3>
            <p className="text-xs text-gray-500">Control which experimental features are available to users</p>
          </div>
          <span className="text-xxs px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            You always have access as admin
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(FEATURE_INFO).map(([key, info]) => {
            const isEnabled = flags[key] ?? false
            const isUpdating = flagUpdating === key
            const colorClasses = {
              amber: {
                bg: 'bg-amber-500/20',
                border: 'border-amber-500/30',
                text: 'text-amber-400',
                toggle: 'bg-amber-500'
              },
              emerald: {
                bg: 'bg-emerald-500/20',
                border: 'border-emerald-500/30',
                text: 'text-emerald-400',
                toggle: 'bg-emerald-500'
              },
              violet: {
                bg: 'bg-violet-500/20',
                border: 'border-violet-500/30',
                text: 'text-violet-400',
                toggle: 'bg-violet-500'
              }
            }[info.color]

            return (
              <div
                key={key}
                className={`p-4 rounded-lg border ${isEnabled ? colorClasses.border : 'border-dark-border'} ${isEnabled ? colorClasses.bg : 'bg-dark-bg'} transition-all`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className={`font-medium ${isEnabled ? colorClasses.text : 'text-gray-400'}`}>
                      {info.name}
                    </h4>
                    <span className={`text-xxs ${isEnabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {isEnabled ? 'Available to all users' : 'Admin only'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleFlag(key)}
                    disabled={isUpdating}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      isUpdating ? 'opacity-50 cursor-wait' : ''
                    } ${isEnabled ? colorClasses.toggle : 'bg-gray-600'}`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {info.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
