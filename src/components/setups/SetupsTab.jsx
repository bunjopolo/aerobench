import { useState } from 'react'
import { useAnalyses } from '../../hooks/useAnalyses'
import { useAuth } from '../../hooks/useAuth.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ConfirmDialog, AlertDialog } from '../ui'

// Surface type options
const SURFACE_OPTIONS = [
  { value: '', label: 'Select surface...' },
  { value: 'new_pavement', label: 'New Pavement' },
  { value: 'worn_pavement', label: 'Worn Pavement' },
  { value: 'gravel_cat1', label: 'Category 1 Gravel' },
  { value: 'gravel_cat2', label: 'Category 2 Gravel' },
  { value: 'gravel_cat3', label: 'Category 3 Gravel' },
  { value: 'gravel_cat4', label: 'Category 4 Gravel' },
]

const getSurfaceLabel = (value) => {
  const option = SURFACE_OPTIONS.find(o => o.value === value)
  return option?.label || value || ''
}

// Component to show a single setup's detail view
const SetupDetail = ({ setup, onBack, onSelectSetup, isSelected, onRefresh, updateSetup, deleteSetup }) => {
  const { analyses, loading, updateAnalysis, deleteAnalysis } = useAnalyses(setup.id)
  const [editing, setEditing] = useState(false)
  const [editingAnalysisId, setEditingAnalysisId] = useState(null)
  const [editingAnalysisName, setEditingAnalysisName] = useState('')
  const [deleteSetupDialog, setDeleteSetupDialog] = useState(false)
  const [deleteAnalysisDialog, setDeleteAnalysisDialog] = useState({ open: false, analysisId: null, analysisName: '' })
  const [form, setForm] = useState({
    name: setup.name || '',
    description: setup.description || '',
    bike_name: setup.bike_name || '',
    wheel_type: setup.wheel_type || '',
    tire_type: setup.tire_type || '',
    surface: setup.surface || '',
    front_tire_pressure: setup.front_tire_pressure || '',
    rear_tire_pressure: setup.rear_tire_pressure || '',
    position_notes: setup.position_notes || '',
    cda: setup.cda ?? '',
    crr: setup.crr ?? '',
    mass: setup.mass || 80,
    drivetrain_efficiency: setup.drivetrain_efficiency || 0.975
  })

  const handleSave = async () => {
    // Convert empty strings to null for numeric fields
    const updates = {
      ...form,
      cda: form.cda === '' ? null : form.cda,
      crr: form.crr === '' ? null : form.crr,
      front_tire_pressure: form.front_tire_pressure === '' ? null : form.front_tire_pressure,
      rear_tire_pressure: form.rear_tire_pressure === '' ? null : form.rear_tire_pressure,
    }
    await updateSetup(setup.id, updates)
    setEditing(false)
    onRefresh()
  }

  const handleDelete = () => {
    setDeleteSetupDialog(true)
  }

  const confirmDeleteSetup = async () => {
    await deleteSetup(setup.id)
    setDeleteSetupDialog(false)
    onBack()
  }

  const handleDeleteAnalysis = (analysisId, analysisName) => {
    setDeleteAnalysisDialog({ open: true, analysisId, analysisName })
  }

  const confirmDeleteAnalysis = async () => {
    if (deleteAnalysisDialog.analysisId) {
      await deleteAnalysis(deleteAnalysisDialog.analysisId)
      setDeleteAnalysisDialog({ open: false, analysisId: null, analysisName: '' })
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
              {isSelected ? (
                <span className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium flex items-center gap-2">
                  <span>✓</span> Active Setup
                </span>
              ) : (
                <button onClick={() => onSelectSetup(setup.id)} className="btn-primary">Make Active</button>
              )}
              <button onClick={() => setEditing(true)} className="btn-secondary">Edit</button>
              <button onClick={handleDelete} className="px-3 py-1 text-red-400 hover:bg-red-900/30 rounded transition-colors">Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Current Values */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">CdA</div>
          <div className={`text-xl font-bold font-mono ${setup.cda != null ? 'text-green-400' : 'text-gray-500'}`}>{setup.cda != null ? setup.cda.toFixed(4) : '--'}</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Crr</div>
          <div className={`text-xl font-bold font-mono ${setup.crr != null ? 'text-blue-400' : 'text-gray-500'}`}>{setup.crr != null ? setup.crr.toFixed(5) : '--'}</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">System Mass</div>
          <div className="text-xl font-bold text-gray-300 font-mono">{(setup.mass || 80)} kg</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Efficiency</div>
          <div className="text-xl font-bold text-brand-accent font-mono">{((setup.drivetrain_efficiency || 0.975) * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Analyses</div>
          <div className="text-xl font-bold text-indigo-400 font-mono">{analyses.length}</div>
        </div>
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border">
          <div className="text-xs text-gray-500 uppercase mb-1">Improvement</div>
          <div className={`text-xl font-bold font-mono ${improvement && parseFloat(improvement) < 0 ? 'text-green-400' : 'text-gray-400'}`}>
            {improvement ? `${improvement}%` : '--'}
          </div>
        </div>
      </div>

      {/* Equipment Details (shown when not editing) */}
      {!editing && (setup.wheel_type || setup.tire_type || setup.surface || setup.position_notes || setup.front_tire_pressure || setup.rear_tire_pressure || setup.description) && (
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border mb-6">
          <h3 className="label-sm mb-3">Equipment Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {setup.wheel_type && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Wheels</div>
                <div className="text-sm text-white">{setup.wheel_type}</div>
              </div>
            )}
            {setup.tire_type && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Tires</div>
                <div className="text-sm text-white">{setup.tire_type}</div>
              </div>
            )}
            {setup.surface && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Surface</div>
                <div className="text-sm text-white">{getSurfaceLabel(setup.surface)}</div>
              </div>
            )}
            {(setup.front_tire_pressure || setup.rear_tire_pressure) && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Tire Pressure</div>
                <div className="text-sm text-white font-mono">
                  {setup.front_tire_pressure && <span>F: {setup.front_tire_pressure} psi</span>}
                  {setup.front_tire_pressure && setup.rear_tire_pressure && <span className="text-gray-500 mx-1">|</span>}
                  {setup.rear_tire_pressure && <span>R: {setup.rear_tire_pressure} psi</span>}
                </div>
              </div>
            )}
            {setup.position_notes && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Position</div>
                <div className="text-sm text-white">{setup.position_notes}</div>
              </div>
            )}
          </div>
          {setup.description && (
            <div className="mt-3 pt-3 border-t border-dark-border">
              <div className="text-xs text-gray-500 mb-1">Notes</div>
              <div className="text-sm text-gray-300">{setup.description}</div>
            </div>
          )}
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="bg-dark-card p-4 rounded-xl border border-dark-border mb-6 space-y-4">
          {/* Physics Values */}
          <div>
            <h3 className="label-sm mb-3">Physics Values</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">CdA</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.cda}
                  onChange={e => setForm({ ...form, cda: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="input-dark w-full font-mono"
                  placeholder="e.g., 0.32"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Crr</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.crr}
                  onChange={e => setForm({ ...form, crr: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="input-dark w-full font-mono"
                  placeholder="e.g., 0.004"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">System Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.mass}
                  placeholder="Rider + bike + gear"
                  onChange={e => setForm({ ...form, mass: parseFloat(e.target.value) || 0 })}
                  className="input-dark w-full font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Drivetrain Eff. (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="90"
                  max="100"
                  value={(form.drivetrain_efficiency * 100).toFixed(1)}
                  onChange={e => setForm({ ...form, drivetrain_efficiency: parseFloat(e.target.value) / 100 || 0.975 })}
                  className="input-dark w-full font-mono"
                />
              </div>
            </div>
          </div>

          {/* Equipment Details */}
          <div>
            <h3 className="label-sm mb-3">Equipment Details</h3>
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
                <label className="text-xs text-gray-500 block mb-1">Surface</label>
                <select value={form.surface} onChange={e => setForm({ ...form, surface: e.target.value })} className="input-dark w-full">
                  {SURFACE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Position Notes</label>
                <input type="text" value={form.position_notes} onChange={e => setForm({ ...form, position_notes: e.target.value })} className="input-dark w-full" placeholder="e.g., Aero bars, low" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Front Tire Pressure (psi)</label>
                <input type="number" step="1" value={form.front_tire_pressure} onChange={e => setForm({ ...form, front_tire_pressure: e.target.value ? parseFloat(e.target.value) : '' })} className="input-dark w-full font-mono" placeholder="e.g., 85" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Rear Tire Pressure (psi)</label>
                <input type="number" step="1" value={form.rear_tire_pressure} onChange={e => setForm({ ...form, rear_tire_pressure: e.target.value ? parseFloat(e.target.value) : '' })} className="input-dark w-full font-mono" placeholder="e.g., 90" />
              </div>
            </div>
          </div>

          {/* Description */}
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
                    {editingAnalysisId === analysis.id ? (
                      <input
                        type="text"
                        value={editingAnalysisName}
                        onChange={(e) => setEditingAnalysisName(e.target.value)}
                        className="input-dark text-sm py-1 px-2"
                        autoFocus
                        onBlur={async () => {
                          if (editingAnalysisName.trim()) {
                            await updateAnalysis(analysis.id, { name: editingAnalysisName.trim() })
                          }
                          setEditingAnalysisId(null)
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && editingAnalysisName.trim()) {
                            await updateAnalysis(analysis.id, { name: editingAnalysisName.trim() })
                            setEditingAnalysisId(null)
                          } else if (e.key === 'Escape') {
                            setEditingAnalysisId(null)
                          }
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingAnalysisId(analysis.id)
                          setEditingAnalysisName(analysis.name || 'Analysis')
                        }}
                        className="text-white font-medium text-sm hover:text-brand-accent transition-colors"
                        title="Click to rename"
                      >
                        {analysis.name || 'Analysis'}
                      </button>
                    )}
                    <span className="text-xs text-gray-500">{new Date(analysis.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span className="text-green-400 font-mono">CdA: {analysis.fitted_cda?.toFixed(4) || '--'}</span>
                    <span className="text-blue-400 font-mono">Crr: {analysis.fitted_crr?.toFixed(5) || '--'}</span>
                    {analysis.rmse && <span className="text-gray-400">RMSE: {analysis.rmse.toFixed(3)}m</span>}
                    {analysis.r2 != null && <span className={`font-mono ${analysis.r2 > 0.95 ? 'text-emerald-400' : analysis.r2 > 0.9 ? 'text-yellow-400' : 'text-red-400'}`}>R²: {analysis.r2.toFixed(4)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAnalysis(analysis.id, analysis.name || 'this analysis')}
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

      {/* Delete Setup Confirmation */}
      <ConfirmDialog
        isOpen={deleteSetupDialog}
        onClose={() => setDeleteSetupDialog(false)}
        onConfirm={confirmDeleteSetup}
        title="Delete Setup"
        message={`Are you sure you want to delete "${setup.name}" and all its analyses? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Delete Analysis Confirmation */}
      <ConfirmDialog
        isOpen={deleteAnalysisDialog.open}
        onClose={() => setDeleteAnalysisDialog({ open: false, analysisId: null, analysisName: '' })}
        onConfirm={confirmDeleteAnalysis}
        title="Delete Analysis"
        message={`Are you sure you want to delete "${deleteAnalysisDialog.analysisName}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}

export const SetupsTab = ({ selectedSetupId, onSelectSetup, setups, loading, createSetup, updateSetup, deleteSetup, refresh }) => {
  const { user } = useAuth()
  const [viewingSetup, setViewingSetup] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })
  const [newForm, setNewForm] = useState({
    name: '',
    bike_name: '',
    tire_type: '',
    surface: '',
    front_tire_pressure: '',
    rear_tire_pressure: '',
    cda: '',
    crr: '',
    mass: 80,
    drivetrain_efficiency: 0.975
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      // Convert empty strings to null for numeric fields
      const setupData = {
        ...newForm,
        cda: newForm.cda === '' ? null : newForm.cda,
        crr: newForm.crr === '' ? null : newForm.crr,
        front_tire_pressure: newForm.front_tire_pressure === '' ? null : newForm.front_tire_pressure,
        rear_tire_pressure: newForm.rear_tire_pressure === '' ? null : newForm.rear_tire_pressure,
      }
      const created = await createSetup(setupData)
      setShowNewForm(false)
      setNewForm({ name: '', bike_name: '', tire_type: '', surface: '', front_tire_pressure: '', rear_tire_pressure: '', cda: '', crr: '', mass: 80, drivetrain_efficiency: 0.975 })
      // Auto-select new setup and view it
      onSelectSetup(created.id)
      setViewingSetup(created)
    } catch (err) {
      setErrorDialog({ open: true, message: err.message })
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Equipment Setups</h2>
          <p className="text-gray-400 mb-6">
            Save and manage your equipment configurations with their associated aerodynamic values.
          </p>
          <p className="text-sm text-gray-500">
            Sign in from the Dashboard to use this feature.
          </p>
        </div>
      </div>
    )
  }

  // Show detail view if viewing a setup
  if (viewingSetup) {
    // Find the latest version of the setup from the list
    const currentSetup = setups.find(s => s.id === viewingSetup.id) || viewingSetup
    return (
      <SetupDetail
        setup={currentSetup}
        onBack={() => { setViewingSetup(null); refresh(); }}
        onSelectSetup={onSelectSetup}
        isSelected={selectedSetupId === currentSetup.id}
        onRefresh={refresh}
        updateSetup={updateSetup}
        deleteSetup={deleteSetup}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label-sm block mb-1">Tires</label>
                <input
                  type="text"
                  value={newForm.tire_type}
                  onChange={e => setNewForm({ ...newForm, tire_type: e.target.value })}
                  className="input-dark w-full"
                  placeholder="e.g., GP5000 25c"
                />
              </div>
              <div>
                <label className="label-sm block mb-1">Surface</label>
                <select
                  value={newForm.surface}
                  onChange={e => setNewForm({ ...newForm, surface: e.target.value })}
                  className="input-dark w-full"
                >
                  {SURFACE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-sm block mb-1">Front Pressure (psi)</label>
                <input
                  type="number"
                  step="1"
                  value={newForm.front_tire_pressure}
                  onChange={e => setNewForm({ ...newForm, front_tire_pressure: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="input-dark w-full font-mono"
                  placeholder="e.g., 85"
                />
              </div>
              <div>
                <label className="label-sm block mb-1">Rear Pressure (psi)</label>
                <input
                  type="number"
                  step="1"
                  value={newForm.rear_tire_pressure}
                  onChange={e => setNewForm({ ...newForm, rear_tire_pressure: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="input-dark w-full font-mono"
                  placeholder="e.g., 90"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label-sm block mb-1">CdA</label>
                <input
                  type="number"
                  step="0.001"
                  value={newForm.cda}
                  onChange={e => setNewForm({ ...newForm, cda: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="input-dark w-full font-mono"
                  placeholder="e.g., 0.32"
                />
              </div>
              <div>
                <label className="label-sm block mb-1">Crr</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newForm.crr}
                  onChange={e => setNewForm({ ...newForm, crr: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="input-dark w-full font-mono"
                  placeholder="e.g., 0.004"
                />
              </div>
              <div>
                <label className="label-sm block mb-1">System Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newForm.mass}
                  onChange={e => setNewForm({ ...newForm, mass: parseFloat(e.target.value) })}
                  className="input-dark w-full font-mono"
                  placeholder="Rider + bike + gear"
                />
              </div>
              <div>
                <label className="label-sm block mb-1">Drivetrain Eff. (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="90"
                  max="100"
                  value={(newForm.drivetrain_efficiency * 100).toFixed(1)}
                  onChange={e => setNewForm({ ...newForm, drivetrain_efficiency: parseFloat(e.target.value) / 100 || 0.975 })}
                  className="input-dark w-full font-mono"
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
      ) : setups.length === 0 && !showNewForm ? (
        <div className="text-center py-12 bg-dark-card rounded-xl border border-dark-border">
          <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">No setups yet</h3>
          <p className="text-gray-400 mb-4">Create your first equipment setup to start tracking</p>
          <button onClick={() => setShowNewForm(true)} className="btn-primary">Create Setup</button>
        </div>
      ) : setups.length > 0 ? (
        <div className="space-y-3">
          {setups.map(setup => {
            const isActive = selectedSetupId === setup.id
            return (
              <button
                key={setup.id}
                onClick={() => setViewingSetup(setup)}
                className={`w-full text-left bg-dark-card rounded-xl border p-4 transition-all ${
                  isActive
                    ? 'border-green-500/50 ring-1 ring-green-500/20'
                    : 'border-dark-border hover:border-brand-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      {isActive && <span className="text-green-400 text-xs">● Active</span>}
                      {setup.name}
                      {setup.is_favorite && <span className="text-yellow-400">★</span>}
                    </h3>
                    {setup.bike_name && <p className="text-xs text-gray-500">{setup.bike_name}</p>}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">CdA</div>
                      <div className={`font-mono font-bold ${setup.cda != null ? 'text-green-400' : 'text-gray-500'}`}>{setup.cda != null ? setup.cda.toFixed(4) : '--'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Crr</div>
                      <div className={`font-mono font-bold ${setup.crr != null ? 'text-blue-400' : 'text-gray-500'}`}>{setup.crr != null ? setup.crr.toFixed(5) : '--'}</div>
                    </div>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      {/* Error Alert Dialog */}
      <AlertDialog
        isOpen={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, message: '' })}
        title="Error Creating Setup"
        message={errorDialog.message}
        variant="error"
      />
    </div>
  )
}
