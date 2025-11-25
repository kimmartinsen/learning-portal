'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function FocusRefresher() {
  const router = useRouter()
  const lastRefresh = useRef(0)

  useEffect(() => {
    const refresh = () => {
      const now = Date.now()
      // Vent minst 2 sekunder mellom hver refresh for å unngå dobbel-trigger
      // ved fanebytte (som ofte trigger både visibilitychange og focus)
      if (now - lastRefresh.current < 2000) {
        return
      }
      
      lastRefresh.current = now
      router.refresh()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    const onFocus = () => {
      refresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router])

  return null
}

