'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

export function AuthHeader() {
  const pathname = usePathname()
  const isSignupPage = pathname?.includes('/signup')

  const ctaLabel = isSignupPage ? 'Logg inn' : 'Registrer deg'
  const ctaHref = isSignupPage ? '/login' : '/signup'

  return (
    <header className="px-6 py-6 sm:px-10">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Opplæringsportal
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={ctaHref}
            className="rounded-full border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {ctaLabel}
          </Link>
        </div>
      </nav>
    </header>
  )
}

