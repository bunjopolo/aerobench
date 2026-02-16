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
          runs:study_runs(id, name, ride_date, gpx_filename, fitted_cda, fitted_crr, rmse, r2, wind_speed, wind_direction, notes, is_valid, created_at)
        `)
        .eq('study_id', studyId)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (error) throw error

      const rawVariations = data || []

      // Keep exactly one baseline selected for each study.
      if (rawVariations.length > 0) {
        const baselineCount = rawVariations.filter(v => v.is_baseline).length
        if (baselineCount !== 1) {
          const baselineId = rawVariations.find(v => v.is_baseline)?.id || rawVariations[0].id

          const { error: clearBaselineError } = await supabase
            .from('study_variations')
            .update({ is_baseline: false })
            .eq('study_id', studyId)
            .eq('user_id', user.id)

          if (clearBaselineError) throw clearBaselineError

          const { error: setBaselineError } = await supabase
            .from('study_variations')
            .update({ is_baseline: true })
            .eq('id', baselineId)
            .eq('user_id', user.id)

          if (setBaselineError) throw setBaselineError

          rawVariations.forEach(variation => {
            variation.is_baseline = variation.id === baselineId
          })
        }
      }

      // Calculate aggregated stats from valid runs
      const variationsWithStats = rawVariations.map(variation => {
        const validRuns = (variation.runs || []).filter(r => r.is_valid && Number.isFinite(r.fitted_cda))
        const validCrrRuns = validRuns.filter(r => Number.isFinite(r.fitted_crr))
        const runCount = validRuns.length

        let avgCda = null
        let avgCrr = null
        let stdCda = null
        let stdCrr = null

        if (runCount > 0) {
          avgCda = validRuns.reduce((sum, r) => sum + r.fitted_cda, 0) / runCount

          if (validCrrRuns.length > 0) {
            avgCrr = validCrrRuns.reduce((sum, r) => sum + r.fitted_crr, 0) / validCrrRuns.length
          }

          if (runCount > 1) {
            const variance = validRuns.reduce((sum, r) => sum + Math.pow(r.fitted_cda - avgCda, 2), 0) / runCount
            stdCda = Math.sqrt(variance)
          }

          if (validCrrRuns.length > 1 && avgCrr !== null) {
            const varianceCrr = validCrrRuns.reduce((sum, r) => sum + Math.pow(r.fitted_crr - avgCrr, 2), 0) / validCrrRuns.length
            stdCrr = Math.sqrt(varianceCrr)
          }
        }

        return {
          ...variation,
          run_count: runCount,
          total_runs: (variation.runs || []).length,
          avg_cda: avgCda,
          avg_crr: avgCrr,
          std_cda: stdCda,
          std_crr: stdCrr,
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
        sort_order: maxOrder + 1,
        is_baseline: variations.length === 0
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
    const deletingVariation = variations.find(v => v.id === id)
    const remainingVariations = variations.filter(v => v.id !== id)

    const { error } = await supabase
      .from('study_variations')
      .delete()
      .eq('id', id)

    if (error) throw error

    if (deletingVariation?.is_baseline && remainingVariations.length > 0) {
      const nextBaselineId = remainingVariations[0].id

      const { error: clearBaselineError } = await supabase
        .from('study_variations')
        .update({ is_baseline: false })
        .eq('study_id', studyId)
        .eq('user_id', user.id)

      if (clearBaselineError) throw clearBaselineError

      const { error: setBaselineError } = await supabase
        .from('study_variations')
        .update({ is_baseline: true })
        .eq('id', nextBaselineId)
        .eq('user_id', user.id)

      if (setBaselineError) throw setBaselineError

      setVariations(remainingVariations.map(v => ({
        ...v,
        is_baseline: v.id === nextBaselineId
      })))
      return
    }

    setVariations(remainingVariations)
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
