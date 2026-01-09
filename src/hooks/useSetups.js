import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'

export const useSetups = () => {
  const { user } = useAuth()
  const [setups, setSetups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSetups = useCallback(async () => {
    if (!user) {
      setSetups([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('setups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSetups(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchSetups()
  }, [fetchSetups])

  const createSetup = async (setup) => {
    if (!user) throw new Error('Must be logged in')

    const { data, error } = await supabase
      .from('setups')
      .insert({
        ...setup,
        user_id: user.id
      })
      .select()
      .single()

    if (error) throw error
    setSetups(prev => [data, ...prev])
    return data
  }

  const updateSetup = async (id, updates) => {
    const { data, error } = await supabase
      .from('setups')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setSetups(prev => prev.map(s => s.id === id ? data : s))
    return data
  }

  const deleteSetup = async (id) => {
    const { error } = await supabase
      .from('setups')
      .delete()
      .eq('id', id)

    if (error) throw error
    setSetups(prev => prev.filter(s => s.id !== id))
  }

  const toggleFavorite = async (id) => {
    const setup = setups.find(s => s.id === id)
    if (!setup) return
    return updateSetup(id, { is_favorite: !setup.is_favorite })
  }

  return {
    setups,
    loading,
    error,
    createSetup,
    updateSetup,
    deleteSetup,
    toggleFavorite,
    refresh: fetchSetups
  }
}
