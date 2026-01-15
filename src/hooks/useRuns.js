import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'

export const useRuns = (variationId) => {
  const { user } = useAuth()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRuns = useCallback(async () => {
    if (!user || !variationId) {
      setRuns([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('study_runs')
        .select('*')
        .eq('variation_id', variationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRuns(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, variationId])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const createRun = async (run) => {
    if (!user) throw new Error('Must be logged in')
    if (!variationId) throw new Error('Variation ID required')

    const { data, error } = await supabase
      .from('study_runs')
      .insert({
        ...run,
        variation_id: variationId,
        user_id: user.id
      })
      .select()
      .single()

    if (error) throw error
    setRuns(prev => [data, ...prev])
    return data
  }

  const updateRun = async (id, updates) => {
    const { data, error } = await supabase
      .from('study_runs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setRuns(prev => prev.map(r => r.id === id ? data : r))
    return data
  }

  const deleteRun = async (id) => {
    const { error } = await supabase
      .from('study_runs')
      .delete()
      .eq('id', id)

    if (error) throw error
    setRuns(prev => prev.filter(r => r.id !== id))
  }

  const toggleValid = async (id) => {
    const run = runs.find(r => r.id === id)
    if (!run) return

    return updateRun(id, { is_valid: !run.is_valid })
  }

  // Calculate statistics for the runs
  const stats = useCallback(() => {
    const validRuns = runs.filter(r => r.is_valid && r.fitted_cda)
    const n = validRuns.length

    if (n === 0) {
      return { count: 0, avgCda: null, avgCrr: null, stdCda: null, avgRmse: null, avgR2: null }
    }

    const avgCda = validRuns.reduce((sum, r) => sum + r.fitted_cda, 0) / n
    const avgCrr = validRuns.reduce((sum, r) => sum + (r.fitted_crr || 0), 0) / n
    const avgRmse = validRuns.reduce((sum, r) => sum + (r.rmse || 0), 0) / n
    const avgR2 = validRuns.reduce((sum, r) => sum + (r.r2 || 0), 0) / n

    let stdCda = null
    if (n > 1) {
      const variance = validRuns.reduce((sum, r) => sum + Math.pow(r.fitted_cda - avgCda, 2), 0) / n
      stdCda = Math.sqrt(variance)
    }

    return {
      count: n,
      totalCount: runs.length,
      avgCda,
      avgCrr,
      stdCda,
      avgRmse,
      avgR2
    }
  }, [runs])

  return {
    runs,
    loading,
    error,
    stats: stats(),
    createRun,
    updateRun,
    deleteRun,
    toggleValid,
    refresh: fetchRuns
  }
}
