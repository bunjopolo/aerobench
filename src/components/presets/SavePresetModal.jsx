import { useState } from 'react'
import { Dialog } from '../ui'

export const SavePresetModal = ({ values, onSave, onClose }) => {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave({
        name: name.trim(),
        cda: values.cda,
        crr: values.crr,
        mass: values.mass,
        efficiency: values.efficiency,
        rho: values.rho
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Dialog isOpen={true} onClose={loading ? undefined : onClose}>
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold text-white">Save Physics Preset</h2>
          <p className="text-gray-400 text-sm mt-1">Save these values to quickly load them in the Estimator</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Preset Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Road TT Position"
              className="input-dark w-full"
              autoFocus
            />
          </div>

          {/* Values Preview */}
          <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Values to Save</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">CdA</span>
                <span className="font-mono text-green-400">{values.cda?.toFixed(4) || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Crr</span>
                <span className="font-mono text-blue-400">{values.crr?.toFixed(5) || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Mass</span>
                <span className="font-mono text-white">{values.mass?.toFixed(1) || '—'} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Efficiency</span>
                <span className="font-mono text-white">{values.efficiency?.toFixed(2) || '—'}</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-gray-400">Air Density</span>
                <span className="font-mono text-cyan-400">{values.rho?.toFixed(3) || '—'} kg/m³</span>
              </div>
            </div>
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
              {loading ? 'Saving...' : 'Save Preset'}
            </button>
          </div>
        </form>
    </Dialog>
  )
}
