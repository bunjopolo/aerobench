import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'

export const useVariations = (studyId) => {
  const { user } = useAuth()
  const [variations, setVariations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchVariations = useCallback(async () => {
    if (!user || !studyId) {
      setVariations([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('study_variations')
        .select(`
          *,
          runs:study_runs(id, fitted_cda, fitted_crr, rmse, r2, is_valid)
        `)
        .eq('study_id', studyId)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (error) throw error

      // Calculate aggregated stats from valid runs
      const variationsWithStats = (data || []).map(variation => {
        const validRuns = (variation.runs || []).filter(r => r.is_valid && r.fitted_cda)
        const runCount = validRuns.length

        let avgCda = null
        let avgCrr = null
        let stdCda = null

        if (runCount > 0) {
          avgCda = validRuns.reduce((sum, r) => sum + r.fitted_cda, 0) / runCount
          avgCrr = validRuns.reduce((sum, r) => sum + (r.fitted_crr || 0), 0) / runCount

          if (runCount > 1) {
            const variance = validRuns.reduce((sum, r) => sum + Math.pow(r.fitted_cda - avgCda, 2), 0) / runCount
            stdCda = Math.sqrt(variance)
          }
        }

        return {
          ...variation,
          run_count: runCount,
          total_runs: (variation.runs || []).length,
          avg_cda: avgCda,
          avg_crr: avgCrr,
          std_cda: stdCda,
          runs: variation.runs
        }
      })

      setVariations(variationsWithStats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, studyId])

  useEffect(() => {
    fetchVariations()
  }, [fetchVariations])

  const createVariation = async (variation) => {
    if (!user) throw new Error('Must be logged in')
    if (!studyId) throw new Error('Study ID required')

    // Get the max sort_order
    const maxOrder = variations.reduce((max, v) => Math.max(max, v.sort_order || 0), 0)

    const { data, error } = await supabase
      .from('study_variations')
      .insert({
        ...variation,
        study_id: studyId,
        user_id: user.id,
        sort_order: maxOrder + 1
      })
      .select()
      .single()

    if (error) throw error
    setVariations(prev => [...prev, { ...data, run_count: 0, total_runs: 0, runs: [] }])
    return data
  }

  const updateVariation = async (id, updates) => {
    const { data, error } = await supabase
      .from('study_variations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setVariations(prev => prev.map(v => v.id === id ? { ...v, ...data } : v))
    return data
  }

  const deleteVariation = async (id) => {
    const { error } = await supabase
      .from('study_variations')
      .delete()
      .eq('id', id)

    if (error) throw error
    setVariations(prev => prev.filter(v => v.id !== id))
  }

  const setBaseline = async (id) => {
    // First, clear all baselines
    const { error: clearError } = await supabase
      .from('study_variations')
      .update({ is_baseline: false })
      .eq('study_id', studyId)

    if (clearError) throw clearError

    // Set the new baseline
    const { data, error } = await supabase
      .from('study_variations')
      .update({ is_baseline: true })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    setVariations(prev => prev.map(v => ({
      ...v,
      is_baseline: v.id === id
    })))

    return data
  }

  return {
    variations,
    loading,
    error,
    createVariation,
    updateVariation,
    deleteVariation,
    setBaseline,
    refresh: fetchVariations
  }
}
