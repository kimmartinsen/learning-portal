'use client'

import Link from 'next/link'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

export function AuthHeader() {
  return (
    <header className="px-6 py-6 sm:px-10">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Kompetanseportalen
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-full border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Logg inn
          </Link>
          <Link
            href="/signup"
            className="hidden rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-500 sm:inline-flex"
          >
            Registrer deg
          </Link>
        </div>
      </nav>
    </header>
  )
}

