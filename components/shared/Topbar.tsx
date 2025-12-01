'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { generateInitials, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'

interface User {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
}

interface TopbarProps {
  user: User | null
  className?: string
}

export function Topbar({ user, className }: TopbarProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      // Clear all Supabase session data
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) throw error
      
      // Clear any local storage/cache
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // Wait to ensure cookies are cleared
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Force a hard redirect to login with cache busting
      // This ensures all cached data is cleared
      window.location.href = `/login?logout=true&t=${Date.now()}&nocache=1`
    } catch (error) {
      console.error('Logout error:', error)
      // Even if logout fails, clear storage and redirect
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = `/login?logout=true&t=${Date.now()}&nocache=1`
      }
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-900 px-4 py-4 transition-colors duration-200 lg:px-8',
        className
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-semibold">
              O
            </div>
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Kompetanseportalen
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-3 md:space-x-4">
          <ThemeToggle />

          {/* Notifications */}
          {user && <NotificationDropdown userId={user.id} />}

          {/* User info & logout */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role === 'admin' ? 'Administrator' : 'Bruker'}
              </p>
            </div>
            
            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-primary-700 dark:text-primary-200 text-sm font-medium">
                  {generateInitials(user?.full_name || '')}
                </span>
              )}
            </div>

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
              title="Logg ut"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
