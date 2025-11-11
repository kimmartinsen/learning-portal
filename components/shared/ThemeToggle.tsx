'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-200 dark:hover:border-gray-600 ${className ?? ''}`}
      aria-label={isDark ? 'Bytt til lys modus' : 'Bytt til mørk modus'}
    >
      {mounted ? (
        <>
          {isDark ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )}
          {isDark ? 'Lys' : 'Mørk'} modus
        </>
      ) : (
        <div className="h-4 w-4 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
      )}
    </button>
  )
}

