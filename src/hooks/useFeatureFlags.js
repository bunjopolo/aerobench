import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Admin email for bypassing feature flags
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

// Default flags (used while loading or if DB unavailable)
const DEFAULT_FLAGS = {
  method_shen: false,
  method_climb: false,
  method_sweep: false
}

export const useFeatureFlags = () => {
  const { user } = useAuth()
  const [flags, setFlags] = useState(DEFAULT_FLAGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is admin
  const isAdmin = user?.email === ADMIN_EMAIL

  // Fetch feature flags from database
  const fetchFlags = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('feature_flags')
        .select('feature_key, enabled')

      if (fetchError) {
        // Table might not exist yet
        if (fetchError.message.includes('does not exist') || fetchError.code === '42P01') {
          console.debug('Feature flags table not found, using defaults')
          setFlags(DEFAULT_FLAGS)
        } else {
          throw fetchError
        }
      } else if (data) {
        // Convert array to object
        const flagsObj = { ...DEFAULT_FLAGS }
        data.forEach(row => {
          flagsObj[row.feature_key] = row.enabled
        })
        setFlags(flagsObj)
      }
    } catch (err) {
      console.warn('Error fetching feature flags:', err)
      setError(err.message)
      setFlags(DEFAULT_FLAGS)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchFlags()
  }, [fetchFlags])

  // Check if a feature is enabled
  // Admin always has access to all features
  const isFeatureEnabled = useCallback((featureKey) => {
    if (isAdmin) return true
    return flags[featureKey] ?? false
  }, [flags, isAdmin])

  // Update a feature flag (admin only)
  const updateFlag = useCallback(async (featureKey, enabled) => {
    if (!isAdmin) {
      console.warn('Only admin can update feature flags')
      return false
    }

    try {
      const { error: updateError } = await supabase
        .from('feature_flags')
        .update({ enabled })
        .eq('feature_key', featureKey)

      if (updateError) throw updateError

      // Update local state
      setFlags(prev => ({ ...prev, [featureKey]: enabled }))
      return true
    } catch (err) {
      console.error('Error updating feature flag:', err)
      setError(err.message)
      return false
    }
  }, [isAdmin])

  return {
    flags,
    loading,
    error,
    isAdmin,
    isFeatureEnabled,
    updateFlag,
    refresh: fetchFlags
  }
}

// Simple hook for components that just need to check feature access
export const useFeature = (featureKey) => {
  const { isFeatureEnabled, loading } = useFeatureFlags()
  return { enabled: isFeatureEnabled(featureKey), loading }
}
