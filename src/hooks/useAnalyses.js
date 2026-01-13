import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'

export const useAnalyses = (setupId = null) => {
  const { user } = useAuth()
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAnalyses = useCallback(async () => {
    if (!user) {
      setAnalyses([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      let query = supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Filter by setup if provided
      if (setupId) {
        query = query.eq('setup_id', setupId)
      }

      const { data, error } = await query

      if (error) throw error
      setAnalyses(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, setupId])

  useEffect(() => {
    fetchAnalyses()
  }, [fetchAnalyses])

  const createAnalysis = async (analysis) => {
    if (!user) throw new Error('Must be logged in')

    const { data, error } = await supabase
      .from('analyses')
      .insert({
        ...analysis,
        user_id: user.id
      })
      .select()
      .single()

    if (error) throw error
    setAnalyses(prev => [data, ...prev])
    return data
  }

  const updateAnalysis = async (id, updates) => {
    const { data, error } = await supabase
      .from('analyses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setAnalyses(prev => prev.map(a => a.id === id ? data : a))
    return data
  }

  const deleteAnalysis = async (id) => {
    const { error } = await supabase
      .from('analyses')
      .delete()
      .eq('id', id)

    if (error) throw error
    setAnalyses(prev => prev.filter(a => a.id !== id))
  }

  return {
    analyses,
    loading,
    error,
    createAnalysis,
    updateAnalysis,
    deleteAnalysis,
    refresh: fetchAnalyses
  }
}
