'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function FocusRefresher() {
  const router = useRouter()

  useEffect(() => {
    const onRefresh = () => {
      router.refresh()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }

    // Lytt på både fokus (vindu aktivt) og visibility (fanebytte)
    window.addEventListener('focus', onRefresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', onRefresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router])

  return null
}

