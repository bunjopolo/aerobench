import { useState, useEffect } from 'react'
import { useSetups } from '../../hooks/useSetups'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useAnalyses } from '../../hooks/useAnalyses'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

// Surface label helper
const SURFACE_LABELS = {
  'new_pavement': 'New Pavement',
  'worn_pavement': 'Worn Pavement',
  'gravel_cat1': 'Cat 1 Gravel',
  'gravel_cat2': 'Cat 2 Gravel',
  'gravel_cat3': 'Cat 3 Gravel',
  'gravel_cat4': 'Cat 4 Gravel',
}
const getSurfaceLabel = (value) => SURFACE_LABELS[value] || value || '-'

export const DashboardTab = ({ physics }) => {
  const { user } = useAuth()
  const { setups, loading } = useSetups()
  const { analyses } = useAnalyses() // Fetch all analyses

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please sign in to view dashboard</p>
      </div>
    )
  }

  // Calculate stats from analyses (actual measured values) or fall back to setups
  const analysesWithCda = analyses.filter(a => a.fitted_cda > 0)
  const analysesWithCrr = analyses.filter(a => a.fitted_crr > 0)
  const setupsWithCda = setups.filter(s => s.cda != null)
  const setupsWithCrr = setups.filter(s => s.crr != null)
  const bestCda = analysesWithCda.length > 0
    ? Math.min(...analysesWithCda.map(a => a.fitted_cda))
    : (setupsWithCda.length > 0 ? Math.min(...setupsWithCda.map(s => s.cda)) : null)
  const bestCrr = analysesWithCrr.length > 0
    ? Math.min(...analysesWithCrr.map(a => a.fitted_crr))
    : (setupsWithCrr.length > 0 ? Math.min(...setupsWithCrr.map(s => s.crr)) : null)

  // Speed comparison data for bar chart (only setups with CdA/Crr values)
  const setupsWithValues = setups.filter(s => s.cda != null && s.crr != null)
  const speedComparisonData = setupsWithValues.slice(0, 5).map(s => {
    const K = 0.5 * 1.225 * s.cda
    const fRes = (s.mass || 80) * 9.81 * s.crr
    const pwr = 250 * (s.drivetrain_efficiency || 0.975)
    let v = 10
    for (let i = 0; i < 10; i++) {
      const f = K * v * v * v + fRes * v - pwr
      const df = 3 * K * v * v + fRes
      if (Math.abs(df) < 1e-6) break
      v = v - f / df
    }
    return {
      name: s.name?.substring(0, 12) || 'Setup',
      speed: parseFloat((v * 3.6).toFixed(1)),
      cda: s.cda
    }
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 text-sm">Overview of your performance data</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Total Setups</div>
          <div className="text-3xl font-bold text-white">{setups.length}</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Best CdA</div>
          <div className="text-3xl font-bold text-green-400 font-mono">
            {bestCda ? bestCda.toFixed(4) : '--'}
          </div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Best Crr</div>
          <div className="text-3xl font-bold text-blue-400 font-mono">
            {bestCrr ? bestCrr.toFixed(5) : '--'}
          </div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Total Analyses</div>
          <div className="text-3xl font-bold text-indigo-400">{analyses.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CdA Progress Chart */}
        <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">CdA Progress Over Time</h3>
          {(() => {
            // Group analyses by setup and prepare chart data
            const setupColors = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa', '#fb923c']
            const analysesWithSetup = analyses.filter(a => a.fitted_cda && a.setup_id)

            // Get unique dates across all analyses
            const allDates = [...new Set(analysesWithSetup.map(a =>
              new Date(a.created_at).toLocaleDateString()
            ))].sort((a, b) => new Date(a) - new Date(b))

            // Get setups that have analyses
            const setupsWithAnalyses = setups.filter(s =>
              analysesWithSetup.some(a => a.setup_id === s.id)
            )

            // Build chart data: each row is a date, with a column per setup
            const chartData = allDates.map(date => {
              const row = { date }
              setupsWithAnalyses.forEach(setup => {
                const analysis = analysesWithSetup.find(a =>
                  a.setup_id === setup.id &&
                  new Date(a.created_at).toLocaleDateString() === date
                )
                if (analysis) {
                  row[setup.name] = analysis.fitted_cda
                }
              })
              return row
            })

            return chartData.length > 0 && setupsWithAnalyses.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis
                    domain={['dataMin - 0.005', 'dataMax + 0.005']}
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value.toFixed(4)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value) => [value.toFixed(4), 'CdA']}
                  />
                  <Legend />
                  {setupsWithAnalyses.map((setup, i) => (
                    <Line
                      key={setup.id}
                      type="monotone"
                      dataKey={setup.name}
                      stroke={setupColors[i % setupColors.length]}
                      strokeWidth={2}
                      dot={{ fill: setupColors[i % setupColors.length], r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No analysis history yet. Run analyses in the Analysis tab.
              </div>
            )
          })()}
        </div>

        {/* Speed Comparison */}
        <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Setup Speed Comparison @ 250W</h3>
          {speedComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={speedComparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[35, 50]} stroke="#94a3b8" tick={{ fontSize: 10 }} unit=" km/h" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  formatter={(value) => [`${value} km/h`, 'Speed']}
                />
                <Bar dataKey="speed" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              Create setups to compare speeds
            </div>
          )}
        </div>
      </div>

      {/* Recent Setups */}
      <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Recent Setups</h3>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary mx-auto"></div>
          </div>
        ) : setups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b border-dark-border">
                <tr>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Bike</th>
                  <th className="text-left py-2">Wheels</th>
                  <th className="text-left py-2">Tires</th>
                  <th className="text-left py-2">Surface</th>
                  <th className="text-center py-2">Pressure (F/R)</th>
                  <th className="text-center py-2">CdA</th>
                  <th className="text-center py-2">Crr</th>
                  <th className="text-center py-2">Mass</th>
                  <th className="text-right py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {setups.slice(0, 5).map(setup => (
                  <tr key={setup.id} className="hover:bg-dark-bg/50">
                    <td className="py-3 font-medium text-white whitespace-nowrap">
                      {setup.is_favorite && <span className="text-yellow-400 mr-1">★</span>}
                      {setup.name}
                    </td>
                    <td className="py-3 text-gray-400">{setup.bike_name || '-'}</td>
                    <td className="py-3 text-gray-400">{setup.wheel_type || '-'}</td>
                    <td className="py-3 text-gray-400">{setup.tire_type || '-'}</td>
                    <td className="py-3 text-gray-400">{getSurfaceLabel(setup.surface)}</td>
                    <td className="py-3 text-center font-mono text-gray-400">
                      {setup.front_tire_pressure || setup.rear_tire_pressure
                        ? `${setup.front_tire_pressure || '-'}/${setup.rear_tire_pressure || '-'}`
                        : '-'}
                    </td>
                    <td className={`py-3 text-center font-mono ${setup.cda != null ? 'text-green-400' : 'text-gray-500'}`}>
                      {setup.cda != null ? setup.cda.toFixed(4) : '--'}
                    </td>
                    <td className={`py-3 text-center font-mono ${setup.crr != null ? 'text-blue-400' : 'text-gray-500'}`}>
                      {setup.crr != null ? setup.crr.toFixed(5) : '--'}
                    </td>
                    <td className="py-3 text-center font-mono">{setup.mass || '-'}</td>
                    <td className="py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                      {setup.created_at ? new Date(setup.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No setups created yet</p>
            <p className="text-xs mt-1">Go to "My Setups" to create your first configuration</p>
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-6 rounded-xl border border-indigo-500/20">
        <h3 className="text-sm font-bold text-indigo-300 uppercase mb-3">Quick Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-white font-medium">Consistent Testing</p>
              <p className="text-gray-400 text-xs">Test on the same course in similar conditions for accurate comparisons</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-white font-medium">Target CdA</p>
              <p className="text-gray-400 text-xs">Pro cyclists typically achieve 0.20-0.25 in aero positions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <p className="text-white font-medium">Track Progress</p>
              <p className="text-gray-400 text-xs">Small improvements compound - 5% CdA reduction = ~1.5% speed gain</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
