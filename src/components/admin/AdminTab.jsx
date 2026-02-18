import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import { supabase } from '../../lib/supabase'

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
    name: 'Solution Space Visualizer',
    description: '2D solution space visualization showing CdA/Crr degeneracy and fit quality',
    color: 'violet'
  }
}

export const AdminTab = () => {
  const { user } = useAuth()
  const { flags, updateFlag } = useFeatureFlags()
  const [flagUpdating, setFlagUpdating] = useState(null)
  const [tires, setTires] = useState([])
  const [tiresLoading, setTiresLoading] = useState(true)
  const [tireError, setTireError] = useState('')
  const [tireSaving, setTireSaving] = useState(false)
  const [editingTireId, setEditingTireId] = useState(null)
  const [tireForm, setTireForm] = useState({
    brand: '',
    model: '',
    version: '',
    category: 'road',
    tire_type: 'tubeless',
    size_label: '',
    width_nominal_mm: '',
    brr_drum_crr: '',
    is_active: true
  })

  // Check if user is admin
  const isAdmin = user?.email === ADMIN_EMAIL

  // Handle feature flag toggle
  const handleToggleFlag = async (featureKey) => {
    setFlagUpdating(featureKey)
    const newValue = !flags[featureKey]
    await updateFlag(featureKey, newValue)
    setFlagUpdating(null)
  }

  const fetchTires = async () => {
    setTireError('')
    setTiresLoading(true)
    try {
      const { data, error } = await supabase
        .from('tires')
        .select('*')
        .order('brand', { ascending: true })
        .order('model', { ascending: true })
        .order('size_label', { ascending: true })

      if (error) throw error
      setTires(data || [])
    } catch (err) {
      setTireError(err.message || 'Failed to load tires')
    } finally {
      setTiresLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    fetchTires()
  }, [isAdmin])

  const handleTireFormChange = (field, value) => {
    setTireForm(prev => ({ ...prev, [field]: value }))
  }

  const resetTireForm = () => {
    setEditingTireId(null)
    setTireForm({
      brand: '',
      model: '',
      version: '',
      category: 'road',
      tire_type: 'tubeless',
      size_label: '',
      width_nominal_mm: '',
      brr_drum_crr: '',
      is_active: true
    })
  }

  const handleSaveTire = async (e) => {
    e.preventDefault()
    if (!tireForm.brand.trim() || !tireForm.model.trim()) {
      setTireError('Brand and model are required')
      return
    }

    setTireSaving(true)
    setTireError('')
    try {
      const payload = {
        brand: tireForm.brand.trim(),
        model: tireForm.model.trim(),
        version: tireForm.version.trim() || null,
        category: tireForm.category,
        tire_type: tireForm.tire_type || null,
        size_label: tireForm.size_label.trim() || null,
        width_nominal_mm: tireForm.width_nominal_mm === '' ? null : Number(tireForm.width_nominal_mm),
        brr_drum_crr: tireForm.brr_drum_crr === '' ? null : Number(tireForm.brr_drum_crr),
        is_active: tireForm.is_active
      }

      let error = null
      if (editingTireId) {
        const result = await supabase
          .from('tires')
          .update(payload)
          .eq('id', editingTireId)
        error = result.error
      } else {
        const result = await supabase
          .from('tires')
          .insert(payload)
        error = result.error
      }

      if (error) throw error

      resetTireForm()
      await fetchTires()
    } catch (err) {
      setTireError(err.message || 'Failed to create tire')
    } finally {
      setTireSaving(false)
    }
  }

  const handleEditTire = (tire) => {
    setEditingTireId(tire.id)
    setTireError('')
    setTireForm({
      brand: tire.brand || '',
      model: tire.model || '',
      version: tire.version || '',
      category: tire.category || 'road',
      tire_type: tire.tire_type || 'tubeless',
      size_label: tire.size_label || '',
      width_nominal_mm: tire.width_nominal_mm ?? '',
      brr_drum_crr: tire.brr_drum_crr ?? '',
      is_active: tire.is_active ?? true
    })
  }

  const handleDeleteTire = async (tire) => {
    const confirmed = window.confirm(`Delete tire entry "${tire.brand} ${tire.model}"?`)
    if (!confirmed) return

    setTireError('')
    try {
      const { error } = await supabase
        .from('tires')
        .delete()
        .eq('id', tire.id)

      if (error) throw error

      if (editingTireId === tire.id) resetTireForm()
      await fetchTires()
    } catch (err) {
      setTireError(err.message || 'Failed to delete tire')
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

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Manage feature flags and app settings</p>
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

      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Tire Catalog</h3>
            <p className="text-xs text-gray-500">Add basic tire entries for future user-submitted observation data</p>
          </div>
          <button
            onClick={fetchTires}
            className="text-xs text-gray-400 hover:text-white border border-dark-border px-3 py-1.5 rounded"
          >
            Refresh
          </button>
        </div>

        <form onSubmit={handleSaveTire} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            className="input-dark md:col-span-1"
            placeholder="Brand *"
            value={tireForm.brand}
            onChange={(e) => handleTireFormChange('brand', e.target.value)}
          />
          <input
            className="input-dark md:col-span-1"
            placeholder="Model *"
            value={tireForm.model}
            onChange={(e) => handleTireFormChange('model', e.target.value)}
          />
          <input
            className="input-dark md:col-span-1"
            placeholder="Version"
            value={tireForm.version}
            onChange={(e) => handleTireFormChange('version', e.target.value)}
          />
          <select
            className="input-dark md:col-span-1"
            value={tireForm.category}
            onChange={(e) => handleTireFormChange('category', e.target.value)}
          >
            <option value="road">Road</option>
            <option value="gravel">Gravel</option>
            <option value="mtb">MTB</option>
          </select>

          <select
            className="input-dark md:col-span-1"
            value={tireForm.tire_type}
            onChange={(e) => handleTireFormChange('tire_type', e.target.value)}
          >
            <option value="tubeless">Tubeless</option>
            <option value="clincher">Clincher</option>
            <option value="tubular">Tubular</option>
          </select>
          <input
            className="input-dark md:col-span-1"
            placeholder="Size (e.g. 700x28)"
            value={tireForm.size_label}
            onChange={(e) => handleTireFormChange('size_label', e.target.value)}
          />
          <input
            type="number"
            step="0.1"
            className="input-dark md:col-span-1"
            placeholder="Nominal Width (mm)"
            value={tireForm.width_nominal_mm}
            onChange={(e) => handleTireFormChange('width_nominal_mm', e.target.value)}
          />
          <input
            type="number"
            step="0.000001"
            className="input-dark md:col-span-1"
            placeholder="BRR Drum Crr"
            value={tireForm.brr_drum_crr}
            onChange={(e) => handleTireFormChange('brr_drum_crr', e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-gray-400 md:col-span-1 px-3 border border-dark-border rounded-lg bg-dark-bg">
            <input
              type="checkbox"
              checked={tireForm.is_active}
              onChange={(e) => handleTireFormChange('is_active', e.target.checked)}
            />
            Active
          </label>

          <div className="md:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetTireForm}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-border rounded-lg"
            >
              {editingTireId ? 'Cancel Edit' : 'Clear'}
            </button>
            <button
              type="submit"
              disabled={tireSaving}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
            >
              {tireSaving ? 'Saving...' : editingTireId ? 'Update Tire' : 'Add Tire'}
            </button>
          </div>
        </form>

        {tireError && (
          <div className="text-xs text-red-400 mb-3">{tireError}</div>
        )}

        <div className="rounded-lg border border-dark-border overflow-hidden">
          <div className="grid grid-cols-9 gap-2 px-3 py-2 text-xxs uppercase text-gray-500 bg-dark-bg border-b border-dark-border">
            <span>Brand</span>
            <span>Model</span>
            <span>Version</span>
            <span>Category</span>
            <span>Type</span>
            <span>Size</span>
            <span>Width</span>
            <span>BRR Crr</span>
            <span className="text-right">Actions</span>
          </div>

          {tiresLoading ? (
            <div className="px-3 py-6 text-sm text-gray-500 text-center">Loading tires...</div>
          ) : tires.length === 0 ? (
            <div className="px-3 py-6 text-sm text-gray-500 text-center">No tires yet</div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {tires.map(tire => (
                <div key={tire.id} className="grid grid-cols-9 gap-2 px-3 py-2 text-xs text-gray-300 border-b border-dark-border last:border-b-0">
                  <span className="truncate">{tire.brand}</span>
                  <span className="truncate">{tire.model}</span>
                  <span className="truncate">{tire.version || '-'}</span>
                  <span className="uppercase">{tire.category}</span>
                  <span className="capitalize">{tire.tire_type || '-'}</span>
                  <span className="truncate">{tire.size_label || '-'}</span>
                  <span>{tire.width_nominal_mm ?? '-'}</span>
                  <span>{tire.brr_drum_crr ?? '-'}</span>
                  <span className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEditTire(tire)}
                      className="text-xxs px-2 py-1 rounded border border-dark-border text-gray-300 hover:text-white hover:bg-dark-bg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTire(tire)}
                      className="text-xxs px-2 py-1 rounded border border-red-500/40 text-red-300 hover:text-red-200 hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
