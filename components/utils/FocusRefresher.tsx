'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export function FocusRefresher() {
  const router = useRouter()
  const pathname = usePathname()
  const lastRefresh = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Check if user has changed (e.g., after logout/login)
    const checkUserChange = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id || null
      
      // If user ID changed, force a hard refresh
      if (lastUserIdRef.current !== null && lastUserIdRef.current !== currentUserId) {
        // User changed, force hard refresh
        window.location.reload()
        return
      }
      
      // Initialize on first mount
      if (lastUserIdRef.current === null && currentUserId) {
        lastUserIdRef.current = currentUserId
      }
    }

    // Check user change immediately and on mount
    checkUserChange()
    
    // Also check on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const newUserId = session?.user?.id || null
        if (lastUserIdRef.current !== null && lastUserIdRef.current !== newUserId) {
          window.location.reload()
        }
        lastUserIdRef.current = newUserId
      }
    })
    
    return () => {
      subscription.unsubscribe()
    }

    const refresh = () => {
      const now = Date.now()
      // Throttle: Vent minst 2 sekunder mellom hver refresh
      if (now - lastRefresh.current < 2000) {
        return
      }
      
      lastRefresh.current = now
      router.refresh()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkUserChange()
        refresh()
      }
    }

    const onFocus = () => {
      checkUserChange()
      refresh()
    }

    // Polling: Oppdater hvert 10. sekund når på "Min opplæring"-siden
    if (pathname === '/my-learning') {
      intervalRef.current = setInterval(() => {
        checkUserChange()
        refresh()
      }, 10000) // 10 sekunder
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [router, pathname])

  return null
}

