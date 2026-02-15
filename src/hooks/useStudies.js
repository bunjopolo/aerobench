import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'

export const useStudies = () => {
  const { user } = useAuth()
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStudies = useCallback(async () => {
    if (!user) {
      setStudies([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('studies')
        .select(`
          *,
          variations:study_variations(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform to include variation count
      const studiesWithCounts = (data || []).map(study => ({
        ...study,
        variation_count: study.variations?.[0]?.count || 0
      }))

      setStudies(studiesWithCounts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchStudies()
  }, [fetchStudies])

  const createStudy = async (study) => {
    if (!user) throw new Error('Must be logged in')

    const { data, error } = await supabase
      .from('studies')
      .insert({
        ...study,
        user_id: user.id
      })
      .select('*')
      .single()

    if (error) throw error

    // DB trigger creates a baseline configuration for every new study.
    setStudies(prev => [{ ...data, variation_count: 1 }, ...prev])
    return data
  }

  const updateStudy = async (id, updates) => {
    const { data, error } = await supabase
      .from('studies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    setStudies(prev => prev.map(s => s.id === id ? { ...data, variation_count: s.variation_count } : s))
    return data
  }

  const deleteStudy = async (id) => {
    const { error } = await supabase
      .from('studies')
      .delete()
      .eq('id', id)

    if (error) throw error
    setStudies(prev => prev.filter(s => s.id !== id))
  }

  const archiveStudy = async (id) => {
    return updateStudy(id, { status: 'archived' })
  }

  const completeStudy = async (id) => {
    return updateStudy(id, { status: 'completed' })
  }

  return {
    studies,
    loading,
    error,
    createStudy,
    updateStudy,
    deleteStudy,
    archiveStudy,
    completeStudy,
    refresh: fetchStudies
  }
}

// Hook to get a single study by ID
export const useStudy = (studyId) => {
  const { user } = useAuth()
  const [study, setStudy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStudy = useCallback(async () => {
    if (!user || !studyId) {
      setStudy(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('studies')
        .select('*')
        .eq('id', studyId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setStudy(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, studyId])

  useEffect(() => {
    fetchStudy()
  }, [fetchStudy])

  return {
    study,
    loading,
    error,
    refresh: fetchStudy
  }
}
