import { useState, useEffect } from 'react'
import { useSetups } from '../../hooks/useSetups'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useAnalyses } from '../../hooks/useAnalyses'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

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
  const bestCda = analysesWithCda.length > 0
    ? Math.min(...analysesWithCda.map(a => a.fitted_cda))
    : (setups.length > 0 ? Math.min(...setups.map(s => s.cda || 1)) : null)
  const bestCrr = analysesWithCrr.length > 0
    ? Math.min(...analysesWithCrr.map(a => a.fitted_crr))
    : (setups.length > 0 ? Math.min(...setups.map(s => s.crr || 1)) : null)

  // Speed comparison data for bar chart
  const speedComparisonData = setups.slice(0, 5).map(s => {
    const K = 0.5 * 1.225 * (s.cda || 0.3)
    const fRes = (s.mass || 80) * 9.81 * (s.crr || 0.004)
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
            // Prepare chart data from analyses (oldest first)
            const chartData = [...analyses]
              .filter(a => a.fitted_cda)
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              .map(a => ({
                date: new Date(a.created_at).toLocaleDateString(),
                cda: a.fitted_cda,
                name: a.name || 'Analysis'
              }))

            return chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis domain={['dataMin - 0.01', 'dataMax + 0.01']} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value) => [value.toFixed(4), 'CdA']}
                  />
                  <Line type="monotone" dataKey="cda" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 4 }} name="CdA" />
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
                  <th className="text-center py-2">CdA</th>
                  <th className="text-center py-2">Crr</th>
                  <th className="text-center py-2">Mass</th>
                  <th className="text-right py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {setups.slice(0, 5).map(setup => (
                  <tr key={setup.id} className="hover:bg-dark-bg/50">
                    <td className="py-3 font-medium text-white">
                      {setup.is_favorite && <span className="text-yellow-400 mr-1">★</span>}
                      {setup.name}
                    </td>
                    <td className="py-3 text-gray-400">{setup.bike_name || '-'}</td>
                    <td className="py-3 text-center font-mono text-green-400">{(setup.cda || 0).toFixed(4)}</td>
                    <td className="py-3 text-center font-mono text-blue-400">{(setup.crr || 0).toFixed(5)}</td>
                    <td className="py-3 text-center font-mono">{setup.mass || '-'}</td>
                    <td className="py-3 text-right text-gray-500 text-xs">
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
