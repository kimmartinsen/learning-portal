'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ProgramError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Program error:', error)
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
          Kunne ikke laste programmet
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Dette programmet eksisterer ikke eller du har ikke tilgang til det.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()}>
            Prøv igjen
          </Button>
          <Button variant="secondary" onClick={() => router.push('/my-learning')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake til Min opplæring
          </Button>
        </div>
      </div>
    </div>
  )
}

