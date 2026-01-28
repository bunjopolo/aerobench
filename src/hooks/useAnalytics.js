import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Cache for user location (fetched once per session)
let cachedLocation = null
let locationFetchPromise = null

// Fetch user location from IP (using free ipapi.co service)
const fetchUserLocation = async () => {
  if (cachedLocation) return cachedLocation
  if (locationFetchPromise) return locationFetchPromise

  locationFetchPromise = (async () => {
    try {
      const response = await fetch('https://ipapi.co/json/', {
        headers: { 'Accept': 'application/json' }
      })
      if (!response.ok) throw new Error('Failed to fetch location')

      const data = await response.json()
      cachedLocation = {
        country: data.country_name || null,
        country_code: data.country_code || null,
        region: data.region || null,
        city: data.city || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timezone: data.timezone || null
      }
      return cachedLocation
    } catch (err) {
      console.debug('Location fetch error:', err)
      // Fallback to timezone-based approximation
      cachedLocation = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
      }
      return cachedLocation
    }
  })()

  return locationFetchPromise
}

// Track analytics events
export const useAnalytics = () => {
  const { user } = useAuth()
  const lastPageView = useRef(null)
  const locationRef = useRef(null)

  // Fetch location on mount
  useEffect(() => {
    fetchUserLocation().then(loc => {
      locationRef.current = loc
    })
  }, [])

  // Track a generic event
  const trackEvent = useCallback(async (eventType, eventName, metadata = {}) => {
    try {
      // Include location in metadata if available
      const location = locationRef.current || cachedLocation
      const enrichedMetadata = location
        ? { ...metadata, location }
        : metadata

      const { error } = await supabase.from('analytics_events').insert({
        user_id: user?.id || null,
        event_type: eventType,
        event_name: eventName,
        metadata: enrichedMetadata
      })
      if (error) {
        console.warn('Analytics insert error:', error.message, error.details)
      }
    } catch (err) {
      // Silently fail - analytics shouldn't break the app
      console.warn('Analytics error:', err)
    }
  }, [user?.id])

  // Track page view (debounced to avoid spam)
  const trackPageView = useCallback((pageName) => {
    const now = Date.now()
    const key = `${pageName}-${user?.id || 'anon'}`

    // Debounce: don't track same page within 5 seconds
    if (lastPageView.current?.key === key && now - lastPageView.current.time < 5000) {
      return
    }

    lastPageView.current = { key, time: now }
    trackEvent('page_view', pageName)
  }, [trackEvent, user?.id])

  // Track feature usage
  const trackFeature = useCallback((featureName, metadata = {}) => {
    trackEvent('feature_use', featureName, metadata)
  }, [trackEvent])

  // Track action (button clicks, form submissions, etc.)
  const trackAction = useCallback((actionName, metadata = {}) => {
    trackEvent('action', actionName, metadata)
  }, [trackEvent])

  return {
    trackEvent,
    trackPageView,
    trackFeature,
    trackAction
  }
}

// Hook to track page view on mount
export const usePageView = (pageName) => {
  const { trackPageView } = useAnalytics()

  useEffect(() => {
    if (pageName) {
      trackPageView(pageName)
    }
  }, [pageName, trackPageView])
}
