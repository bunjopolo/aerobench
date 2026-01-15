import { useState } from 'react'
import { useStudy } from '../../hooks/useStudies'
import { useVariations } from '../../hooks/useVariations'
import { useRuns } from '../../hooks/useRuns'
import { getVariableType, VARIABLE_TYPES } from '../../lib/variableTypes'
import { RunAnalysis } from './RunAnalysis'
import { StudyResults } from './StudyResults'

const VariationCard = ({ variation, variableType, isBaseline, onSetBaseline, onEdit, onDelete, onAnalyze }) => {
  const [showMenu, setShowMenu] = useState(false)
  const formattedValue = variableType.formatValue(variation)
  const hasData = variation.avg_cda !== null && variation.run_count > 0

  return (
    <div className={`bg-dark-card rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
      isBaseline ? 'border-brand-primary shadow-brand-primary/10' : 'border-dark-border hover:border-gray-600'
    }`}>
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-white text-lg truncate">{variation.name}</h4>
              {isBaseline && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30 font-medium uppercase tracking-wide">
                  Baseline
                </span>
              )}
            </div>
            {formattedValue && (
              <p className="text-sm text-gray-400 mt-0.5">{formattedValue}</p>
            )}
          </div>

          {/* Menu */}
          <div className="relative ml-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-dark-bg rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-dark-card border border-dark-border rounded-lg shadow-xl z-20 py-1">
                  {!isBaseline && (
                    <button
                      onClick={() => { onSetBaseline(); setShowMenu(false) }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-dark-bg flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Set as Baseline
                    </button>
                  )}
                  <button
                    onClick={() => { onEdit(); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-dark-bg flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => { onDelete(); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-4 pb-4">
        {hasData ? (
          <div className="grid grid-cols-3 gap-3">
            {/* CdA */}
            <div className="bg-dark-bg rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">CdA</div>
              <div className="text-lg font-mono font-semibold text-green-400">
                {variation.avg_cda.toFixed(4)}
              </div>
              {variation.std_cda !== null && variation.std_cda > 0 && (
                <div className="text-[10px] text-gray-500 font-mono">
                  ±{variation.std_cda.toFixed(4)}
                </div>
              )}
            </div>

            {/* Crr */}
            <div className="bg-dark-bg rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Crr</div>
              <div className="text-lg font-mono font-semibold text-blue-400">
                {variation.avg_crr?.toFixed(5) || '—'}
              </div>
            </div>

            {/* Runs */}
            <div className="bg-dark-bg rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Runs</div>
              <div className="text-lg font-semibold text-white">
                {variation.run_count}
                {variation.total_runs > variation.run_count && (
                  <span className="text-sm text-gray-500 font-normal">/{variation.total_runs}</span>
                )}
              </div>
              {variation.run_count < 3 && (
                <div className="text-[10px] text-amber-500">Need more data</div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-dark-bg rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm">No runs recorded yet</p>
            <p className="text-gray-600 text-xs mt-1">Add a run to see CdA and Crr values</p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-4 pb-4">
        <button
          onClick={onAnalyze}
          className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Run
        </button>
      </div>
    </div>
  )
}

// Simplified run card for averaging mode
const RunCard = ({ run, onToggleValid, onDelete }) => {
  return (
    <div className={`bg-dark-card rounded-lg border p-4 ${
      run.is_valid ? 'border-dark-border' : 'border-red-500/30 opacity-60'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate">{run.name || 'Untitled Run'}</h4>
            {!run.is_valid && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                Excluded
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {run.ride_date ? new Date(run.ride_date).toLocaleDateString() : 'No date'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="text-right">
            <div className="text-sm font-mono">
              <span className="text-green-400">{run.fitted_cda?.toFixed(4) || '—'}</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-blue-400">{run.fitted_crr?.toFixed(5) || '—'}</span>
            </div>
            <div className="text-[10px] text-gray-500">CdA / Crr</div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleValid}
              className={`p-1.5 rounded hover:bg-dark-bg transition-colors ${
                run.is_valid ? 'text-green-400' : 'text-red-400'
              }`}
              title={run.is_valid ? 'Exclude from average' : 'Include in average'}
            >
              {run.is_valid ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-dark-bg transition-colors"
              title="Delete run"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const AddConfigurationModal = ({ variableType, customLabel, onClose, onCreate }) => {
  const [form, setForm] = useState({
    name: '',
    value_text: '',
    value_number: '',
    value_number_front: '',
    value_number_rear: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Configuration name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onCreate({
        name: form.name.trim(),
        value_text: form.value_text.trim() || null,
        value_number: form.value_number ? parseFloat(form.value_number) : null,
        value_number_front: form.value_number_front ? parseFloat(form.value_number_front) : null,
        value_number_rear: form.value_number_rear ? parseFloat(form.value_number_rear) : null,
        notes: form.notes.trim() || null
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const renderValueInput = () => {
    if (variableType.inputType === 'pressure') {
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Front (psi)</label>
            <input
              type="number"
              value={form.value_number_front}
              onChange={e => setForm({ ...form, value_number_front: e.target.value })}
              className="input-dark w-full"
              placeholder="80"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rear (psi)</label>
            <input
              type="number"
              value={form.value_number_rear}
              onChange={e => setForm({ ...form, value_number_rear: e.target.value })}
              className="input-dark w-full"
              placeholder="85"
            />
          </div>
        </div>
      )
    }

    if (variableType.inputType === 'dropdown') {
      return (
        <select
          value={form.value_text}
          onChange={e => setForm({ ...form, value_text: e.target.value })}
          className="input-dark w-full"
        >
          <option value="">Select...</option>
          {variableType.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }

    return (
      <input
        type="text"
        value={form.value_text}
        onChange={e => setForm({ ...form, value_text: e.target.value })}
        className="input-dark w-full"
        placeholder={variableType.placeholder}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-xl border border-dark-border w-full max-w-md animate-fade-in">
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-white">Add Configuration</h2>
          <p className="text-gray-400 text-sm mt-1">Add a new {customLabel || variableType.label.toLowerCase()} configuration to test</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-dark w-full"
              placeholder="e.g., High Pressure Test"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {customLabel || variableType.label}
            </label>
            {renderValueInput()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Notes <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input-dark w-full h-20 resize-none"
              placeholder="Any notes about this variation..."
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EditConfigurationModal = ({ variation, variableType, customLabel, onClose, onUpdate }) => {
  const [form, setForm] = useState({
    name: variation.name || '',
    value_text: variation.value_text || '',
    value_number: variation.value_number || '',
    value_number_front: variation.value_number_front || '',
    value_number_rear: variation.value_number_rear || '',
    notes: variation.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Configuration name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onUpdate(variation.id, {
        name: form.name.trim(),
        value_text: form.value_text?.trim() || null,
        value_number: form.value_number ? parseFloat(form.value_number) : null,
        value_number_front: form.value_number_front ? parseFloat(form.value_number_front) : null,
        value_number_rear: form.value_number_rear ? parseFloat(form.value_number_rear) : null,
        notes: form.notes?.trim() || null
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const renderValueInput = () => {
    if (variableType.inputType === 'pressure') {
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Front (psi)</label>
            <input
              type="number"
              value={form.value_number_front}
              onChange={e => setForm({ ...form, value_number_front: e.target.value })}
              className="input-dark w-full"
              placeholder="80"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rear (psi)</label>
            <input
              type="number"
              value={form.value_number_rear}
              onChange={e => setForm({ ...form, value_number_rear: e.target.value })}
              className="input-dark w-full"
              placeholder="85"
            />
          </div>
        </div>
      )
    }

    if (variableType.inputType === 'dropdown') {
      return (
        <select
          value={form.value_text}
          onChange={e => setForm({ ...form, value_text: e.target.value })}
          className="input-dark w-full"
        >
          <option value="">Select...</option>
          {variableType.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }

    return (
      <input
        type="text"
        value={form.value_text}
        onChange={e => setForm({ ...form, value_text: e.target.value })}
        className="input-dark w-full"
        placeholder={variableType.placeholder}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-xl border border-dark-border w-full max-w-md animate-fade-in">
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-white">Edit Configuration</h2>
          <p className="text-gray-400 text-sm mt-1">Update {customLabel || variableType.label.toLowerCase()} configuration details</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-dark w-full"
              placeholder="e.g., Aero Helmet Config"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {customLabel || variableType.label}
            </label>
            {renderValueInput()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Notes <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input-dark w-full h-20 resize-none"
              placeholder="Any notes about this configuration..."
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Averaging mode view - simplified, no configurations
const AveragingStudyView = ({ study, variation, onBack, onDelete, onAnalyze }) => {
  const { runs, stats, toggleValid, deleteRun, refresh } = useRuns(variation?.id)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  if (showAnalysis) {
    return (
      <RunAnalysis
        variation={variation}
        study={study}
        onBack={() => {
          setShowAnalysis(false)
          refresh()
        }}
      />
    )
  }

  const handleDeleteRun = async (runId) => {
    if (confirm('Delete this run?')) {
      await deleteRun(runId)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{study.name}</h2>
          <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
            <span className="bg-dark-bg px-2 py-0.5 rounded">Averaging</span>
            <span>{study.mass}kg</span>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="btn-secondary text-red-400 hover:bg-red-900/20"
        >
          Delete
        </button>
      </div>

      {study.description && (
        <p className="text-gray-400 mb-6">{study.description}</p>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-card rounded-xl border border-dark-border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg CdA</div>
          <div className="text-2xl font-mono font-bold text-green-400">
            {stats.avgCda?.toFixed(4) || '—'}
          </div>
          {stats.stdCda && (
            <div className="text-xs text-gray-500 font-mono">±{stats.stdCda.toFixed(4)}</div>
          )}
        </div>
        <div className="bg-dark-card rounded-xl border border-dark-border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Crr</div>
          <div className="text-2xl font-mono font-bold text-blue-400">
            {stats.avgCrr?.toFixed(5) || '—'}
          </div>
        </div>
        <div className="bg-dark-card rounded-xl border border-dark-border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Valid Runs</div>
          <div className="text-2xl font-bold text-white">
            {stats.count}
            {stats.totalCount > stats.count && (
              <span className="text-sm text-gray-500 font-normal">/{stats.totalCount}</span>
            )}
          </div>
        </div>
        <div className="bg-dark-card rounded-xl border border-dark-border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Fit Quality</div>
          <div className="text-2xl font-bold text-amber-400">
            {stats.avgR2 ? `${(stats.avgR2 * 100).toFixed(0)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Add Run Button */}
      <button
        onClick={() => setShowAnalysis(true)}
        className="w-full btn-primary py-3 mb-6 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Run
      </button>

      {/* Runs List */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Runs ({runs.length})</h3>
        {runs.length === 0 ? (
          <div className="text-center py-8 bg-dark-card rounded-xl border border-dark-border">
            <p className="text-gray-400">No runs yet. Add your first run to establish your baseline.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map(run => (
              <RunCard
                key={run.id}
                run={run}
                onToggleValid={() => toggleValid(run.id)}
                onDelete={() => handleDeleteRun(run.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tip for new users */}
      {runs.length > 0 && runs.length < 3 && (
        <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
          <h4 className="text-blue-400 font-medium mb-1">Tip: Add more runs</h4>
          <p className="text-sm text-gray-400">
            3-5 runs gives you a more reliable average. More runs = more confidence in your baseline.
          </p>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl border border-dark-border w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-white mb-2">Delete Study?</h3>
            <p className="text-gray-400 mb-4">
              This will permanently delete "{study.name}" and all its runs.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const StudyDetail = ({ studyId, onBack, onDelete }) => {
  const { study, loading: studyLoading } = useStudy(studyId)
  const { variations, loading: variationsLoading, createVariation, updateVariation, deleteVariation, setBaseline, refresh } = useVariations(studyId)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingVariation, setEditingVariation] = useState(null)
  const [analyzingVariation, setAnalyzingVariation] = useState(null)
  const [showResults, setShowResults] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (studyLoading || variationsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (!study) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Study not found</p>
      </div>
    )
  }

  // For averaging mode, show simplified view
  if (study.study_mode === 'averaging') {
    return (
      <AveragingStudyView
        study={study}
        variation={variations[0]}
        onBack={onBack}
        onDelete={onDelete}
      />
    )
  }

  const variableType = getVariableType(study.variable_type)

  // If analyzing a configuration, show the RunAnalysis component
  if (analyzingVariation) {
    return (
      <RunAnalysis
        variation={analyzingVariation}
        study={study}
        onBack={() => {
          setAnalyzingVariation(null)
          refresh()
        }}
      />
    )
  }

  // If showing results, show the StudyResults component
  if (showResults) {
    return (
      <StudyResults
        study={study}
        variations={variations}
        onBack={() => setShowResults(false)}
      />
    )
  }

  const handleDelete = async () => {
    await onDelete()
  }

  const handleDeleteVariation = async (variationId) => {
    if (confirm('Delete this configuration and all its runs?')) {
      await deleteVariation(variationId)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{study.name}</h2>
          <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
            <span className="bg-dark-bg px-2 py-0.5 rounded">{variableType.label}</span>
            <span>{study.mass}kg</span>
          </div>
        </div>
        <div className="flex gap-2">
          {variations.length >= 2 && (
            <button
              onClick={() => setShowResults(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Results
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-secondary text-red-400 hover:bg-red-900/20"
          >
            Delete Study
          </button>
        </div>
      </div>

      {study.description && (
        <p className="text-gray-400 mb-6">{study.description}</p>
      )}

      {/* Configurations Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Configurations</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-sm"
          >
            + Add Configuration
          </button>
        </div>

        {variations.length === 0 ? (
          <div className="text-center py-12 bg-dark-card rounded-xl border border-dark-border">
            <h3 className="text-lg font-medium text-white mb-2">No configurations yet</h3>
            <p className="text-gray-400">Add your first configuration to start testing</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {variations.map(variation => (
              <VariationCard
                key={variation.id}
                variation={variation}
                variableType={variableType}
                isBaseline={variation.is_baseline}
                onSetBaseline={() => setBaseline(variation.id)}
                onEdit={() => setEditingVariation(variation)}
                onDelete={() => handleDeleteVariation(variation.id)}
                onAnalyze={() => setAnalyzingVariation(variation)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      {variations.length > 0 && variations.length < 2 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
          <h4 className="text-blue-400 font-medium mb-2">Tip: Add more configurations</h4>
          <p className="text-sm text-gray-400">
            Add at least 2 configurations to compare results. For best results, do 3-5 runs per configuration.
          </p>
        </div>
      )}

      {/* Add Configuration Modal */}
      {showAddModal && (
        <AddConfigurationModal
          variableType={variableType}
          customLabel={study.variable_label}
          onClose={() => setShowAddModal(false)}
          onCreate={createVariation}
        />
      )}

      {/* Edit Configuration Modal */}
      {editingVariation && (
        <EditConfigurationModal
          variation={editingVariation}
          variableType={variableType}
          customLabel={study.variable_label}
          onClose={() => setEditingVariation(null)}
          onUpdate={updateVariation}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl border border-dark-border w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-white mb-2">Delete Study?</h3>
            <p className="text-gray-400 mb-4">
              This will permanently delete "{study.name}" and all its configurations and runs.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
