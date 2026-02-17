import { useState } from 'react'
import { useStudy } from '../../hooks/useStudies'
import { useVariations } from '../../hooks/useVariations'
import { getVariableType } from '../../lib/variableTypes'
import { RunAnalysis } from './RunAnalysis'
import { StudyResults } from './StudyResults'
import { ConfirmDialog, Dialog } from '../ui'
import { SavePresetModal } from '../presets'

const VariationCard = ({ variation, variableType, isBaseline, onSetBaseline, onEdit, onDelete, onAnalyze, onSavePreset }) => {
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
                <span className="text-xxs px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30 font-medium uppercase tracking-wide">
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
                  <button
                    onClick={() => { onEdit(); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-dark-bg flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  {hasData && onSavePreset && (
                    <button
                      onClick={() => { onSavePreset(); setShowMenu(false) }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-dark-bg flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save Simulator Preset
                    </button>
                  )}
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
              <div className="text-xxs text-gray-500 uppercase tracking-wide mb-1">CdA</div>
              <div className="text-lg font-mono font-semibold text-green-400">
                {variation.avg_cda.toFixed(4)}
              </div>
              {variation.std_cda !== null && variation.std_cda > 0 && (
                <div className="text-xxs text-gray-500 font-mono">
                  ±{variation.std_cda.toFixed(4)}
                </div>
              )}
            </div>

            {/* Crr */}
            <div className="bg-dark-bg rounded-lg p-3">
              <div className="text-xxs text-gray-500 uppercase tracking-wide mb-1">Crr</div>
              <div className="text-lg font-mono font-semibold text-blue-400">
                {variation.avg_crr?.toFixed(5) || '—'}
              </div>
              {variation.std_crr !== null && variation.std_crr > 0 && (
                <div className="text-xxs text-gray-500 font-mono">
                  ±{variation.std_crr.toFixed(5)}
                </div>
              )}
            </div>

            {/* Runs */}
            <div className="bg-dark-bg rounded-lg p-3">
              <div className="text-xxs text-gray-500 uppercase tracking-wide mb-1">Runs</div>
              <div className="text-lg font-semibold text-white">
                {variation.run_count}
                {variation.total_runs > variation.run_count && (
                  <span className="text-sm text-gray-500 font-normal">/{variation.total_runs}</span>
                )}
              </div>
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
      <div className="px-4 pb-4 space-y-2">
        <button
          onClick={onAnalyze}
          className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Run
        </button>
        {!isBaseline && (
          <button
            onClick={onSetBaseline}
            className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-gray-400 hover:text-white border border-dark-border hover:border-brand-primary/50 rounded-lg transition-all hover:bg-brand-primary/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Set as Baseline
          </button>
        )}
      </div>
    </div>
  )
}

const AddConfigurationModal = ({ variableType, customLabel, onClose, onCreate }) => {
  const hasVariableField = variableType.inputType !== 'none'
  const variableName = (customLabel || variableType.label || 'variable').toLowerCase()

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
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rear (psi)</label>
            <input
              type="number"
              value={form.value_number_rear}
              onChange={e => setForm({ ...form, value_number_rear: e.target.value })}
              className="input-dark w-full"
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
      />
    )
  }

  return (
    <Dialog isOpen={true} onClose={loading ? undefined : onClose}>
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-white">Add Configuration</h2>
          <p className="text-gray-400 text-sm mt-1">
            {hasVariableField
              ? `Add a new ${variableName} configuration to test`
              : 'Add a new configuration to test'}
          </p>
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
              autoFocus
            />
          </div>

          {hasVariableField && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {customLabel || variableType.label}
              </label>
              {renderValueInput()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Notes <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input-dark w-full h-20 resize-none"
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
    </Dialog>
  )
}

const EditConfigurationModal = ({ variation, variableType, customLabel, onClose, onUpdate }) => {
  const hasVariableField = variableType.inputType !== 'none'
  const variableName = (customLabel || variableType.label || 'variable').toLowerCase()

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
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rear (psi)</label>
            <input
              type="number"
              value={form.value_number_rear}
              onChange={e => setForm({ ...form, value_number_rear: e.target.value })}
              className="input-dark w-full"
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
      />
    )
  }

  return (
    <Dialog isOpen={true} onClose={loading ? undefined : onClose}>
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-white">Edit Configuration</h2>
          <p className="text-gray-400 text-sm mt-1">
            {hasVariableField
              ? `Update ${variableName} configuration details`
              : 'Update configuration details'}
          </p>
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
              autoFocus
            />
          </div>

          {hasVariableField && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {customLabel || variableType.label}
              </label>
              {renderValueInput()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Notes <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input-dark w-full h-20 resize-none"
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
    </Dialog>
  )
}

export const StudyDetail = ({ studyId, onBack, onDelete, presetsHook }) => {
  const { study, loading: studyLoading } = useStudy(studyId)
  const { variations, loading: variationsLoading, createVariation, updateVariation, deleteVariation, setBaseline, refresh } = useVariations(studyId)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingVariation, setEditingVariation] = useState(null)
  const [analyzingVariation, setAnalyzingVariation] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteVariationDialog, setDeleteVariationDialog] = useState({ open: false, variationId: null, variationName: '' })
  const [presetVariation, setPresetVariation] = useState(null)

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

  const variableType = getVariableType(study.variable_type)
  const variableLabel = study.variable_label || variableType.label

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

  const handleDelete = async () => {
    await onDelete()
  }

  const handleDeleteVariation = (variationId, variationName) => {
    setDeleteVariationDialog({ open: true, variationId, variationName })
  }

  const confirmDeleteVariation = async () => {
    if (deleteVariationDialog.variationId) {
      await deleteVariation(deleteVariationDialog.variationId)
      setDeleteVariationDialog({ open: false, variationId: null, variationName: '' })
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
            <span className="bg-dark-bg px-2 py-0.5 rounded">{variableLabel}</span>
            <span>{study.mass}kg</span>
          </div>
        </div>
        <div className="flex gap-2">
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

      <StudyResults study={study} variations={variations} embedded showMethodologyNote={false} />

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
                onDelete={() => handleDeleteVariation(variation.id, variation.name)}
                onAnalyze={() => setAnalyzingVariation(variation)}
                onSavePreset={presetsHook ? () => setPresetVariation(variation) : null}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-dark-bg rounded-xl border border-dark-border text-xs text-gray-500">
        <p className="mb-1"><strong className="text-gray-400">Note:</strong> Watts saved calculated using P = ½ρCdAv³ at reference speed of 40 km/h.</p>
        <p>Speed gains are approximate and highly dependant on your testing procedure, consistency and data integrity.</p>
      </div>

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

      {/* Delete Study Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Study"
        message={`This will permanently delete "${study.name}" and all its configurations and runs. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Delete Configuration Confirmation */}
      <ConfirmDialog
        isOpen={deleteVariationDialog.open}
        onClose={() => setDeleteVariationDialog({ open: false, variationId: null, variationName: '' })}
        onConfirm={confirmDeleteVariation}
        title="Delete Configuration"
        message={`Are you sure you want to delete "${deleteVariationDialog.variationName}" and all its runs? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Save Preset Modal */}
      {presetVariation && presetsHook && (
        <SavePresetModal
          values={{
            cda: presetVariation.avg_cda,
            crr: presetVariation.avg_crr,
            mass: study.mass,
            efficiency: study.drivetrain_efficiency,
            rho: 1.225  // Default air density, studies don't store this
          }}
          onSave={presetsHook.createPreset}
          onClose={() => setPresetVariation(null)}
        />
      )}
    </div>
  )
}
