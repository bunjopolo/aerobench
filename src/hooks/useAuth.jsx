import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) throw error
  }

  const signInWithGithub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error: globalError } = await supabase.auth.signOut({ scope: 'global' })

    if (globalError) {
      // Fallback: still clear local session so the user can log out on this device.
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
      if (localError) throw globalError
    }

    setUser(null)
  }

  const deleteAccount = async () => {
    const { error } = await supabase.rpc('delete_user_account')
    if (error) throw error
    // Sign out after deletion
    await supabase.auth.signOut()
  }

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    deleteAccount,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
