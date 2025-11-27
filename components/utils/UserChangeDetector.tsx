'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

/**
 * Component that detects user changes and forces a hard refresh
 * This ensures that cached data from previous users is cleared
 */
export function UserChangeDetector() {
  const pathname = usePathname()
  const lastUserIdRef = useRef<string | null>(null)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return

    const checkAndUpdateUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUserId = session?.user?.id || null

        // On first check, just store the user ID
        if (!hasCheckedRef.current) {
          lastUserIdRef.current = currentUserId
          hasCheckedRef.current = true
          return
        }

        // If user ID changed, force a hard refresh
        if (lastUserIdRef.current !== null && lastUserIdRef.current !== currentUserId) {
          console.log('User changed, forcing hard refresh')
          window.location.reload()
          return
        }

        // Update stored user ID
        lastUserIdRef.current = currentUserId
      } catch (error) {
        console.error('Error checking user change:', error)
      }
    }

    // Check immediately
    checkAndUpdateUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        const newUserId = session?.user?.id || null
        
        if (lastUserIdRef.current !== null && lastUserIdRef.current !== newUserId) {
          console.log('Auth state changed, user ID changed, forcing hard refresh')
          window.location.reload()
        } else {
          lastUserIdRef.current = newUserId
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname])

  return null
}

