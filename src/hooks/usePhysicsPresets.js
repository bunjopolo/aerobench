import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'

export const usePhysicsPresets = () => {
  const { user } = useAuth()
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPresets = useCallback(async () => {
    if (!user) {
      setPresets([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('physics_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPresets(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  const createPreset = async (preset) => {
    if (!user) throw new Error('Must be logged in')

    const { data, error } = await supabase
      .from('physics_presets')
      .insert({
        ...preset,
        user_id: user.id
      })
      .select('*')
      .single()

    if (error) throw error
    setPresets(prev => [data, ...prev])
    return data
  }

  const deletePreset = async (id) => {
    const { error } = await supabase
      .from('physics_presets')
      .delete()
      .eq('id', id)

    if (error) throw error
    setPresets(prev => prev.filter(p => p.id !== id))
  }

  return {
    presets,
    loading,
    error,
    createPreset,
    deletePreset,
    refresh: fetchPresets
  }
}
