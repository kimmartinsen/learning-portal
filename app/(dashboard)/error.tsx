'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
            <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Noe gikk galt
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Vi beklager, men det oppstod en uventet feil. Vennligst prøv igjen.
        </p>

        {error.message && (
          <div className="mb-6 rounded-lg bg-gray-100 p-4 text-left dark:bg-gray-800">
            <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()}>
            Prøv igjen
          </Button>
          <Button variant="secondary" onClick={() => window.location.href = '/dashboard'}>
            Gå til dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

