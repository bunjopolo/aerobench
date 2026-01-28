import { useState, useEffect, useMemo } from 'react'
import Plot from 'react-plotly.js'
import { supabase } from '../../lib/supabase'
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
  const { flags, updateFlag, refresh: refreshFlags } = useFeatureFlags()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dailyData, setDailyData] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [locationData, setLocationData] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    todayUsers: 0,
    totalEvents: 0,
    todayEvents: 0
  })
  const [daysBack, setDaysBack] = useState(30)
  const [showDebug, setShowDebug] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)
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

  useEffect(() => {
    if (!isAdmin) return
    fetchAnalytics()
  }, [isAdmin, daysBack])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)

    try {
      // First check if tables exist by trying to query them
      const { data: daily, error: dailyErr } = await supabase
        .from('analytics_daily_summary')
        .select('*')
        .gte('date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (dailyErr) {
        if (dailyErr.message.includes('does not exist') || dailyErr.code === '42P01') {
          throw new Error('Analytics tables not found. Please run the migration: supabase/migrations/011_analytics.sql')
        }
        throw dailyErr
      }
      setDailyData(daily || [])

      // Fetch recent events (with location data)
      const { data: events, error: eventsErr } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (eventsErr) throw eventsErr
      setRecentEvents(events || [])

      // Extract location data from events
      const locations = []
      const seenLocations = new Set()
      events?.forEach(event => {
        const loc = event.metadata?.location
        if (loc?.country) {
          const key = `${loc.city || ''}-${loc.country}`
          if (!seenLocations.has(key)) {
            seenLocations.add(key)
            locations.push({
              country: loc.country,
              country_code: loc.country_code,
              city: loc.city,
              region: loc.region,
              latitude: loc.latitude,
              longitude: loc.longitude,
              count: 1
            })
          } else {
            const existing = locations.find(l => `${l.city || ''}-${l.country}` === key)
            if (existing) existing.count++
          }
        }
      })
      setLocationData(locations)

      // Set debug info
      setDebugInfo({
        tablesExist: true,
        dailyRows: daily?.length || 0,
        eventsRows: events?.length || 0,
        locationsFound: locations.length,
        sampleEvent: events?.[0] || null
      })

      // Calculate stats
      const today = new Date().toISOString().split('T')[0]
      const todayData = daily?.find(d => d.date === today)

      setStats({
        totalUsers: daily?.reduce((sum, d) => sum + (d.unique_users || 0), 0) || 0,
        todayUsers: todayData?.unique_users || 0,
        totalEvents: daily?.reduce((sum, d) => sum + (d.total_events || 0), 0) || 0,
        todayEvents: todayData?.total_events || 0
      })

    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-amber-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Analytics</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-indigo-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const dates = dailyData.map(d => d.date)
  const uniqueUsers = dailyData.map(d => d.unique_users || 0)
  const totalEvents = dailyData.map(d => d.total_events || 0)
  const pageViews = dailyData.map(d => d.page_views || 0)

  // Aggregate feature usage
  const featureUsage = {}
  dailyData.forEach(d => {
    if (d.feature_uses) {
      Object.entries(d.feature_uses).forEach(([feature, count]) => {
        featureUsage[feature] = (featureUsage[feature] || 0) + count
      })
    }
  })

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Usage analytics and metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(parseInt(e.target.value))}
            className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-white hover:bg-dark-input transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Today's Users</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.todayUsers}</p>
          <p className="text-xs text-emerald-400 mt-1">Active today</p>
        </div>
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total Users ({daysBack}d)</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.totalUsers}</p>
          <p className="text-xs text-blue-400 mt-1">Unique visitors</p>
        </div>
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Today's Events</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.todayEvents}</p>
          <p className="text-xs text-violet-400 mt-1">Actions tracked</p>
        </div>
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total Events ({daysBack}d)</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.totalEvents}</p>
          <p className="text-xs text-amber-400 mt-1">All interactions</p>
        </div>
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

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Daily Active Users Chart */}
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="text-white font-medium mb-4">Daily Active Users</h3>
          {dates.length > 0 ? (
            <Plot
              data={[
                {
                  x: dates,
                  y: uniqueUsers,
                  type: 'scatter',
                  mode: 'lines+markers',
                  fill: 'tozeroy',
                  line: { color: '#6366f1', width: 2 },
                  marker: { size: 6 },
                  fillcolor: 'rgba(99, 102, 241, 0.1)'
                }
              ]}
              layout={{
                autosize: true,
                height: 250,
                margin: { t: 10, r: 20, b: 40, l: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#94a3b8', size: 10 },
                xaxis: { gridcolor: '#1e293b', tickangle: -45 },
                yaxis: { gridcolor: '#1e293b', title: 'Users' }
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
              No data yet. Analytics will appear once users start using the app.
            </div>
          )}
        </div>

        {/* Events Over Time Chart */}
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="text-white font-medium mb-4">Events Over Time</h3>
          {dates.length > 0 ? (
            <Plot
              data={[
                {
                  x: dates,
                  y: totalEvents,
                  type: 'bar',
                  name: 'Total Events',
                  marker: { color: '#8b5cf6' }
                },
                {
                  x: dates,
                  y: pageViews,
                  type: 'bar',
                  name: 'Page Views',
                  marker: { color: '#06b6d4' }
                }
              ]}
              layout={{
                autosize: true,
                height: 250,
                margin: { t: 10, r: 20, b: 40, l: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#94a3b8', size: 10 },
                xaxis: { gridcolor: '#1e293b', tickangle: -45 },
                yaxis: { gridcolor: '#1e293b', title: 'Count' },
                barmode: 'group',
                legend: { orientation: 'h', y: 1.1, font: { size: 10 } }
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
              No events recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Feature Usage & Recent Events Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Feature Usage */}
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="text-white font-medium mb-4">Feature Usage ({daysBack} days)</h3>
          {Object.keys(featureUsage).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(featureUsage)
                .sort(([, a], [, b]) => b - a)
                .map(([feature, count]) => (
                  <div key={feature} className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">{feature}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-dark-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                          style={{
                            width: `${Math.min(100, (count / Math.max(...Object.values(featureUsage))) * 100)}%`
                          }}
                        />
                      </div>
                      <span className="text-white text-sm font-mono w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No feature usage data yet</p>
          )}
        </div>

        {/* Recent Events */}
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="text-white font-medium mb-4">Recent Events</h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {recentEvents.slice(0, 20).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 border-b border-dark-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    event.event_type === 'page_view' ? 'bg-cyan-400' :
                    event.event_type === 'feature_use' ? 'bg-violet-400' :
                    'bg-amber-400'
                  }`} />
                  <div>
                    <p className="text-white text-sm">{event.event_name}</p>
                    <p className="text-gray-500 text-xs">{event.event_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 text-xs block">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                  {event.metadata?.location?.city && (
                    <span className="text-gray-600 text-xs">
                      {event.metadata.location.city}, {event.metadata.location.country_code}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {recentEvents.length === 0 && (
              <p className="text-gray-500 text-sm">No events recorded yet</p>
            )}
          </div>
        </div>
      </div>

      {/* User Locations */}
      <div className="grid grid-cols-3 gap-6">
        {/* World Map */}
        <div className="col-span-2 bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="text-white font-medium mb-4">User Locations</h3>
          {locationData.length > 0 ? (
            <Plot
              data={[
                {
                  type: 'scattergeo',
                  mode: 'markers',
                  lat: locationData.filter(l => l.latitude).map(l => l.latitude),
                  lon: locationData.filter(l => l.longitude).map(l => l.longitude),
                  text: locationData.filter(l => l.latitude).map(l =>
                    `${l.city || 'Unknown'}, ${l.country}<br>Sessions: ${l.count}`
                  ),
                  marker: {
                    size: locationData.filter(l => l.latitude).map(l => Math.min(30, 8 + l.count * 3)),
                    color: locationData.filter(l => l.latitude).map(l => l.count),
                    colorscale: [[0, '#6366f1'], [1, '#a855f7']],
                    line: { color: '#fff', width: 1 },
                    opacity: 0.8
                  },
                  hoverinfo: 'text'
                }
              ]}
              layout={{
                autosize: true,
                height: 300,
                margin: { t: 0, r: 0, b: 0, l: 0 },
                paper_bgcolor: 'transparent',
                geo: {
                  bgcolor: 'transparent',
                  showland: true,
                  landcolor: '#1e293b',
                  showocean: true,
                  oceancolor: '#0f172a',
                  showcoastlines: true,
                  coastlinecolor: '#334155',
                  showframe: false,
                  projection: { type: 'natural earth' }
                }
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No location data yet
            </div>
          )}
        </div>

        {/* Location List */}
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="text-white font-medium mb-4">Top Locations</h3>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {locationData
              .sort((a, b) => b.count - a.count)
              .slice(0, 15)
              .map((loc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-dark-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getCountryFlag(loc.country_code)}</span>
                    <div>
                      <p className="text-white text-sm">{loc.city || loc.region || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">{loc.country}</p>
                    </div>
                  </div>
                  <span className="text-violet-400 text-sm font-mono">{loc.count}</span>
                </div>
              ))}
            {locationData.length === 0 && (
              <p className="text-gray-500 text-sm">No location data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Countries Summary */}
      {locationData.length > 0 && (
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="text-white font-medium mb-4">Countries</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              locationData.reduce((acc, loc) => {
                acc[loc.country] = (acc[loc.country] || 0) + loc.count
                return acc
              }, {})
            )
              .sort(([, a], [, b]) => b - a)
              .map(([country, count]) => {
                const loc = locationData.find(l => l.country === country)
                return (
                  <div
                    key={country}
                    className="flex items-center gap-2 bg-dark-bg px-3 py-1.5 rounded-full border border-dark-border"
                  >
                    <span>{getCountryFlag(loc?.country_code)}</span>
                    <span className="text-white text-sm">{country}</span>
                    <span className="text-violet-400 text-xs font-mono">{count}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <div className="bg-dark-card rounded-xl p-4 border border-yellow-500/30">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-2 text-yellow-400 text-sm font-medium"
        >
          <svg className={`w-4 h-4 transition-transform ${showDebug ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Debug Info
        </button>
        {showDebug && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Admin Email (env)</p>
                <p className="text-white font-mono">{ADMIN_EMAIL || '(not set)'}</p>
              </div>
              <div>
                <p className="text-gray-500">Your Email</p>
                <p className="text-white font-mono">{user?.email || '(not logged in)'}</p>
              </div>
              <div>
                <p className="text-gray-500">Tables Exist</p>
                <p className={debugInfo?.tablesExist ? 'text-green-400' : 'text-red-400'}>
                  {debugInfo?.tablesExist ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Daily Summary Rows</p>
                <p className="text-white font-mono">{debugInfo?.dailyRows ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Events Rows</p>
                <p className="text-white font-mono">{debugInfo?.eventsRows ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Locations Found</p>
                <p className="text-white font-mono">{debugInfo?.locationsFound ?? 'N/A'}</p>
              </div>
            </div>
            {debugInfo?.sampleEvent && (
              <div>
                <p className="text-gray-500 text-sm mb-1">Sample Event</p>
                <pre className="text-xs text-gray-400 bg-dark-bg p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(debugInfo.sampleEvent, null, 2)}
                </pre>
              </div>
            )}
            <div className="pt-3 border-t border-dark-border">
              <p className="text-yellow-400 text-xs mb-2">If you see 0 events, check:</p>
              <ol className="text-gray-400 text-xs space-y-1 list-decimal list-inside">
                <li>Run the migration: <code className="text-yellow-300">supabase/migrations/011_analytics.sql</code></li>
                <li>Check browser console for "Analytics insert error" messages</li>
                <li>Verify RLS policies are correctly set in Supabase dashboard</li>
                <li>Make sure VITE_ADMIN_EMAIL is set in .env</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper to get country flag emoji from country code
const getCountryFlag = (countryCode) => {
  if (!countryCode) return '🌍'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}
