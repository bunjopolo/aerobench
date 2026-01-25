import { useState } from 'react'

export const PresetSelector = ({ presets, loading, onLoad, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleSelect = (preset) => {
    onLoad(preset)
    setIsOpen(false)
  }

  const handleDelete = async (e, presetId) => {
    e.stopPropagation()
    if (confirmDelete === presetId) {
      await onDelete(presetId)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(presetId)
    }
  }

  if (loading) {
    return (
      <div className="bg-dark-bg rounded-lg p-3 border border-dark-border">
        <div className="text-xs text-gray-500">Loading presets...</div>
      </div>
    )
  }

  if (!presets || presets.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-dark-bg hover:bg-dark-input rounded-lg p-3 border border-dark-border transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-sm text-gray-300">Load Preset</span>
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setIsOpen(false); setConfirmDelete(null) }} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-dark-card border border-dark-border rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
            {presets.map(preset => (
              <div
                key={preset.id}
                onClick={() => handleSelect(preset)}
                className="flex items-center justify-between p-3 hover:bg-dark-bg cursor-pointer border-b border-dark-border last:border-b-0 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm truncate">{preset.name}</div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">
                    <span>CdA: <span className="text-green-400 font-mono">{preset.cda?.toFixed(4)}</span></span>
                    <span>Crr: <span className="text-blue-400 font-mono">{preset.crr?.toFixed(5)}</span></span>
                    <span>Mass: <span className="text-white font-mono">{preset.mass?.toFixed(0)}kg</span></span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, preset.id)}
                  className={`p-1.5 rounded transition-colors ml-2 ${
                    confirmDelete === preset.id
                      ? 'bg-red-500 text-white'
                      : 'text-gray-500 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100'
                  }`}
                  title={confirmDelete === preset.id ? 'Click again to confirm' : 'Delete preset'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
