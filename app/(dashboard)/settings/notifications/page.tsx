'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ArrowLeft, Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { requestNotificationPermission } from '@/lib/services/notifications'

interface NotificationPreferences {
  browser_notifications: boolean
  email_notifications: boolean
  deadline_reminders: boolean
  course_updates: boolean
  achievements: boolean
  system_announcements: boolean
}

export default function NotificationSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default')
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    browser_notifications: true,
    email_notifications: true,
    deadline_reminders: true,
    course_updates: true,
    achievements: true,
    system_announcements: true
  })

  useEffect(() => {
    fetchData()
    checkBrowserPermission()
  }, [])

  const checkBrowserPermission = () => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission)
    }
  }

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)

      // Fetch notification preferences
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (data) {
        setPreferences(data)
      }

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Kunne ikke laste innstillinger')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestBrowserPermission = async () => {
    try {
      const permission = await requestNotificationPermission()
      setBrowserPermission(permission)
      
      if (permission === 'granted') {
        toast.success('Nettleservarsler aktivert')
      } else if (permission === 'denied') {
        toast.error('Du må gi tillatelse i nettleserinnstillingene')
      }
    } catch (error) {
      toast.error('Kunne ikke aktivere nettleservarsler')
    }
  }

  const handleSave = async () => {
    if (!userId) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      toast.success('Innstillinger lagret')
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error('Kunne ikke lagre innstillinger')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            aria-label="Gå tilbake"
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            Tilbake
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Varslingsinnstillinger
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Tilpass hvordan du mottar varslinger
        </p>
      </div>

      {/* Browser Notifications */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Nettleservarsler
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Få popup-varslinger direkte i nettleseren
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Status: {
                  browserPermission === 'granted' 
                    ? '✅ Aktivert' 
                    : browserPermission === 'denied' 
                    ? '❌ Blokkert' 
                    : '⚠️ Ikke aktivert'
                }
              </p>
            </div>
            {browserPermission !== 'granted' && (
              <Button
                onClick={handleRequestBrowserPermission}
                variant="primary"
                size="sm"
              >
                {browserPermission === 'denied' ? 'Se instruksjoner' : 'Aktiver'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              E-postvarslinger
            </h3>
            
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Motta varslinger på e-post
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Få sammendrag av varslinger på e-post
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_notifications}
                onChange={() => handleToggle('email_notifications')}
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Varslingstyper
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    ⏰ Fristpåminnelser
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Varsler om kommende frister (7, 3 og 1 dag før)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.deadline_reminders}
                  onChange={() => handleToggle('deadline_reminders')}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    📚 Kursoppdateringer
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Varsler om nye kurs, endringer og oppdateringer
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.course_updates}
                  onChange={() => handleToggle('course_updates')}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    🏆 Prestasjoner
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Varsler når du fullfører kurs eller når milepæler
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.achievements}
                  onChange={() => handleToggle('achievements')}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    📢 Systemkunngjøringer
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Viktige meldinger fra administratorer
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.system_announcements}
                  onChange={() => handleToggle('system_announcements')}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="primary"
        >
          {saving ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Lagrer...
            </>
          ) : (
            'Lagre innstillinger'
          )}
        </Button>
      </div>
    </div>
  )
}

