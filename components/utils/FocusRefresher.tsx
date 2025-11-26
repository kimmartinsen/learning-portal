'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function FocusRefresher() {
  const router = useRouter()
  const pathname = usePathname()
  const lastRefresh = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
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
        refresh()
      }
    }

    const onFocus = () => {
      refresh()
    }

    // Polling: Oppdater hvert 10. sekund når på "Min opplæring"-siden
    if (pathname === '/my-learning') {
      intervalRef.current = setInterval(() => {
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

