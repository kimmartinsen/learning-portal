'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { 
  Home, 
  BookOpen, 
  Users, 
  Building2, 
  Settings, 
  LogOut, 
  GraduationCap,
  BarChart3,
  Menu,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface User {
  id: string
  role: string
  full_name: string
  company_id: string
}

interface SidebarProps {
  user: User | null
}

const adminMenuItems = [
  { href: '/dashboard', label: 'Oversikt', icon: Home },
  { href: '/my-learning', label: 'Min opplæring', icon: BookOpen },
  { href: '/admin/users', label: 'Brukere', icon: Users },
  { href: '/admin/departments', label: 'Avdelinger', icon: Building2 },
  { href: '/admin/programs', label: 'Programmer', icon: GraduationCap },
  { href: '/admin/reports', label: 'Rapporter', icon: BarChart3 },
]

const instructorMenuItems = [
  { href: '/dashboard', label: 'Oversikt', icon: Home },
  { href: '/my-learning', label: 'Min opplæring', icon: BookOpen },
  { href: '/instructor/programs', label: 'Mine programmer', icon: GraduationCap },
  { href: '/instructor/reports', label: 'Rapporter', icon: BarChart3 },
]

const userMenuItems = [
  { href: '/dashboard', label: 'Oversikt', icon: Home },
  { href: '/my-learning', label: 'Min opplæring', icon: BookOpen },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const getMenuItems = () => {
    if (user?.role === 'admin') return adminMenuItems
    if (user?.role === 'instructor') return instructorMenuItems
    return userMenuItems
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Logget ut')
      router.push('/login')
    } catch (error) {
      toast.error('Kunne ikke logge ut')
    }
  }

  const toggleSidebar = () => setIsOpen(!isOpen)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="bg-white shadow-sm"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out z-40',
          'lg:translate-x-0 lg:static lg:z-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Opplæringsportal
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {getMenuItems().map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200',
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User info & logout */}
          <div className="px-3 py-4 border-t border-gray-200">
            {user && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-900">
                  {user.full_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.role === 'admin' ? 'Administrator' : 
                   user.role === 'instructor' ? 'Instruktør' : 'Bruker'}
                </p>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logg ut
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
