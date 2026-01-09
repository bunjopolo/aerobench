import { useState } from 'react'
import { useSetups } from '../../hooks/useSetups'
import { useAnalyses } from '../../hooks/useAnalyses'
import { useAuth } from '../../hooks/useAuth.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Component to show a single setup's detail view
const SetupDetail = ({ setup, onBack, onLoadSetup, physics, onRefresh }) => {
  const { analyses, loading, deleteAnalysis } = useAnalyses(setup.id)
  const { updateSetup, deleteSetup } = useSetups()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: setup.name || '',
    description: setup.description || '',
    bike_name: setup.bike_name || '',
    wheel_type: setup.wheel_type || '',
    tire_type: setup.tire_type || '',
    position_notes: setup.position_notes || ''
  })

  const handleSave = async () => {
    await updateSetup(setup.id, form)
    setEditing(false)
    onRefresh()
  }

  const handleDelete = async () => {
    if (confirm('Delete this setup and all its analyses?')) {
      await deleteSetup(setup.id)
      onBack()
    }
  }

  // Prepare chart data (oldest first for proper line chart)
  const chartData = [...analyses]
    .reverse()
    .map(a => ({
      date: new Date(a.created_at).toLocaleDateString(),
      cda: a.fitted_cda,
      crr: a.fitted_crr
    }))

  // Calculate improvement
  const improvement = analyses.length >= 2
    ? ((analyses[analyses.length - 1].fitted_cda - analyses[0].fitted_cda) / analyses[analyses.length - 1].fitted_cda * 100).toFixed(1)
    : null

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          {editing ? (
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-dark text-2xl font-bold w-full"
            />
          ) : (
            <h2 className="text-2xl font-bold text-white">{setup.name}</h2>
          )}
          {setup.bike_name && !editing && (
            <p className="text-gray-400 text-sm">{setup.bike_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary">Save</button>
            </>
          ) : (
            <>
              <button onClick={() => onLoadSetup(setup)} className="btn-primary">Use Values</button>
              <button onClick={() => setEditing(true)} className="btn-secondary">Edit</button>
              <button onClick={handleDelete} className="px-3 py-1 text-red-400 hover:bg-red-900/30 rounded transition-colors">Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Current Values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Current CdA</div>
          <div className="text-2xl font-bold text-green-400 font-mono">{(setup.cda || 0).toFixed(4)}</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Current Crr</div>
          <div className="text-2xl font-bold text-blue-400 font-mono">{(setup.crr || 0).toFixed(5)}</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Analyses</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono">{analyses.length}</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Improvement</div>
          <div className={`text-2xl font-bold font-mono ${improvement && parseFloat(improvement) < 0 ? 'text-green-400' : 'text-gray-400'}`}>
            {improvement ? `${improvement}%` : '--'}
          </div>
        </div>
      </div>

      {/* Equipment Details (when editing) */}
      {editing && (
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border mb-6 space-y-3">
          <h3 className="label-sm">Equipment Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bike</label>
              <input type="text" value={form.bike_name} onChange={e => setForm({ ...form, bike_name: e.target.value })} className="input-dark w-full" placeholder="e.g., Cervelo S5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Wheels</label>
              <input type="text" value={form.wheel_type} onChange={e => setForm({ ...form, wheel_type: e.target.value })} className="input-dark w-full" placeholder="e.g., Zipp 404" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tires</label>
              <input type="text" value={form.tire_type} onChange={e => setForm({ ...form, tire_type: e.target.value })} className="input-dark w-full" placeholder="e.g., GP5000 25c" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Position Notes</label>
              <input type="text" value={form.position_notes} onChange={e => setForm({ ...form, position_notes: e.target.value })} className="input-dark w-full" placeholder="e.g., Aero bars, low" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-dark w-full h-16 resize-none" placeholder="Notes about this setup..." />
          </div>
        </div>
      )}

      {/* CdA Progress Chart */}
      <div className="bg-dark-card p-4 rounded-xl border border-dark-border mb-6">
        <h3 className="label-sm mb-4">CdA Progress Over Time</h3>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis domain={['dataMin - 0.005', 'dataMax + 0.005']} stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line type="monotone" dataKey="cda" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 4 }} name="CdA" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
            {chartData.length === 1 ? 'Need at least 2 analyses to show progress' : 'No analyses yet. Run an analysis in the Analysis tab.'}
          </div>
        )}
      </div>

      {/* Analysis History */}
      <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
        <h3 className="label-sm mb-4">Analysis History</h3>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary mx-auto"></div>
          </div>
        ) : analyses.length > 0 ? (
          <div className="space-y-2">
            {analyses.map(analysis => (
              <div key={analysis.id} className="flex items-center justify-between p-3 bg-dark-bg rounded-lg border border-dark-border">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium text-sm">{analysis.name || 'Analysis'}</span>
                    <span className="text-xs text-gray-500">{new Date(analysis.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span className="text-green-400 font-mono">CdA: {analysis.fitted_cda?.toFixed(4) || '--'}</span>
                    <span className="text-blue-400 font-mono">Crr: {analysis.fitted_crr?.toFixed(5) || '--'}</span>
                    {analysis.rmse && <span className="text-gray-400">RMSE: {analysis.rmse.toFixed(3)}m</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteAnalysis(analysis.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                  title="Delete analysis"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No analyses yet</p>
            <p className="text-xs mt-1">Go to the Analysis tab, select this setup, and run an analysis</p>
          </div>
        )}
      </div>
    </div>
  )
}

export const SetupsTab = ({ physics, onLoadSetup }) => {
  const { user } = useAuth()
  const { setups, loading, createSetup, refresh } = useSetups()
  const [selectedSetup, setSelectedSetup] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({
    name: '',
    bike_name: '',
    cda: physics.cda,
    crr: physics.crr,
    mass: physics.mass
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const created = await createSetup(newForm)
      setShowNewForm(false)
      setNewForm({ name: '', bike_name: '', cda: physics.cda, crr: physics.crr, mass: physics.mass })
      setSelectedSetup(created)
    } catch (err) {
      alert('Error creating setup: ' + err.message)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please sign in to manage setups</p>
      </div>
    )
  }

  // Show detail view if a setup is selected
  if (selectedSetup) {
    // Find the latest version of the setup from the list
    const currentSetup = setups.find(s => s.id === selectedSetup.id) || selectedSetup
    return (
      <SetupDetail
        setup={currentSetup}
        onBack={() => { setSelectedSetup(null); refresh(); }}
        onLoadSetup={onLoadSetup}
        physics={physics}
        onRefresh={refresh}
      />
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">My Setups</h2>
          <p className="text-gray-400 text-sm">Track different equipment configurations</p>
        </div>
        <button onClick={() => setShowNewForm(true)} className="btn-primary flex items-center gap-2">
          <span>+</span> New Setup
        </button>
      </div>

      {/* New Setup Form */}
      {showNewForm && (
        <div className="bg-dark-card p-4 rounded-xl border border-brand-primary/50 mb-6 animate-fade-in">
          <h3 className="text-lg font-bold text-white mb-4">Create New Setup</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-sm block mb-1">Setup Name *</label>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                  className="input-dark w-full"
                  placeholder="e.g., Race Setup, Training, Aero Test"
                  required
                />
              </div>
              <div>
                <label className="label-sm block mb-1">Bike</label>
                <input
                  type="text"
                  value={newForm.bike_name}
                  onChange={e => setNewForm({ ...newForm, bike_name: e.target.value })}
                  className="input-dark w-full"
                  placeholder="e.g., Cervelo S5"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label-sm block mb-1">Starting CdA</label>
                <input
                  type="number"
                  step="0.001"
                  value={newForm.cda}
                  onChange={e => setNewForm({ ...newForm, cda: parseFloat(e.target.value) })}
                  className="input-dark w-full"
                />
              </div>
              <div>
                <label className="label-sm block mb-1">Starting Crr</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newForm.crr}
                  onChange={e => setNewForm({ ...newForm, crr: parseFloat(e.target.value) })}
                  className="input-dark w-full"
                />
              </div>
              <div>
                <label className="label-sm block mb-1">Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newForm.mass}
                  onChange={e => setNewForm({ ...newForm, mass: parseFloat(e.target.value) })}
                  className="input-dark w-full"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowNewForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Create Setup</button>
            </div>
          </form>
        </div>
      )}

      {/* Setups List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading setups...</p>
        </div>
      ) : setups.length === 0 ? (
        <div className="text-center py-12 bg-dark-card rounded-xl border border-dark-border">
          <div className="text-5xl mb-4">🚴</div>
          <h3 className="text-lg font-medium text-white mb-2">No setups yet</h3>
          <p className="text-gray-400 mb-4">Create your first equipment setup to start tracking</p>
          <button onClick={() => setShowNewForm(true)} className="btn-primary">Create Setup</button>
        </div>
      ) : (
        <div className="space-y-3">
          {setups.map(setup => (
            <button
              key={setup.id}
              onClick={() => setSelectedSetup(setup)}
              className="w-full text-left bg-dark-card rounded-xl border border-dark-border p-4 hover:border-brand-primary/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    {setup.name}
                    {setup.is_favorite && <span className="text-yellow-400">★</span>}
                  </h3>
                  {setup.bike_name && <p className="text-xs text-gray-500">{setup.bike_name}</p>}
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">CdA</div>
                    <div className="font-mono text-green-400 font-bold">{(setup.cda || 0).toFixed(4)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Crr</div>
                    <div className="font-mono text-blue-400 font-bold">{(setup.crr || 0).toFixed(5)}</div>
                  </div>
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
