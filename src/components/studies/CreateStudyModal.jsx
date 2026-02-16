import { useState } from 'react'
import { VARIABLE_TYPES, getVariableTypeOptions } from '../../lib/variableTypes'
import { Dialog } from '../ui'

export const CreateStudyModal = ({ onClose, onCreate }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    variable_type: 'none',
    variable_label: '',
    mass: '80',
    drivetrain_efficiency: '0.97'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const variableTypes = getVariableTypeOptions()
  const selectedType = VARIABLE_TYPES[form.variable_type]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Study name is required')
      return
    }
    if (!form.mass || parseFloat(form.mass) <= 0) {
      setError('Please enter a valid mass')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onCreate({
        name: form.name.trim(),
        description: form.description.trim() || null,
        variable_type: form.variable_type,
        variable_label: form.variable_type === 'custom' ? form.variable_label.trim() : null,
        mass: parseFloat(form.mass),
        drivetrain_efficiency: parseFloat(form.drivetrain_efficiency)
      })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Dialog isOpen={true} onClose={loading ? undefined : onClose} panelClassName="max-w-lg">
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-white">Create New Study</h2>
          <p className="text-gray-400 text-sm mt-1">
            Start with a baseline configuration, then add more setups to compare.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Study Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Study Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-dark w-full"
              autoFocus
            />
          </div>

          {/* Variable Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              What are you testing?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {variableTypes.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setForm({ ...form, variable_type: type.id })}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    form.variable_type === type.id
                      ? 'border-brand-primary bg-brand-primary/20 text-white'
                      : 'border-dark-border bg-dark-bg text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="text-xs font-medium">{type.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{selectedType?.description}</p>
          </div>

          {/* Custom Label (for custom type) */}
          {form.variable_type === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Variable Name
              </label>
              <input
                type="text"
                value={form.variable_label}
                onChange={e => setForm({ ...form, variable_label: e.target.value })}
                className="input-dark w-full"
              />
            </div>
          )}

          {/* Mass and Efficiency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Total Mass (kg) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={form.mass}
                onChange={e => setForm({ ...form, mass: e.target.value })}
                className="input-dark w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Rider + bike + gear</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Drivetrain Efficiency
              </label>
              <input
                type="number"
                step="0.01"
                min="0.9"
                max="1"
                value={form.drivetrain_efficiency}
                onChange={e => setForm({ ...form, drivetrain_efficiency: e.target.value })}
                className="input-dark w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Usually 0.95-0.98</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-dark w-full h-20 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded p-3">
              {error}
            </div>
          )}

          {/* Actions */}
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
              {loading ? 'Creating...' : 'Create Study'}
            </button>
          </div>
        </form>
    </Dialog>
  )
}
