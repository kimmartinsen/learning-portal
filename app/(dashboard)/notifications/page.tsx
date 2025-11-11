'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ArrowLeft, CheckCheck, Trash2, Filter } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { cn, formatRelativeTime } from '@/lib/utils'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
  type Notification
} from '@/lib/services/notifications'

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [userId, setUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)
      const notifs = await getNotifications(session.user.id, 100)
      setNotifications(notifs)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Kunne ikke laste varslinger')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!userId) return

    const unsubscribe = subscribeToNotifications(userId, (newNotification) => {
      setNotifications(prev => [newNotification, ...prev])
    })

    return () => {
      unsubscribe()
    }
  }, [userId])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      )
    } catch (error) {
      toast.error('Kunne ikke markere som lest')
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!userId) return
    try {
      await markAllAsRead(userId)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success('Alle varslinger markert som lest')
    } catch (error) {
      toast.error('Kunne ikke markere alle som lest')
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      toast.success('Varsling slettet')
    } catch (error) {
      toast.error('Kunne ikke slette varsling')
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'assignment_created':
        return '📚'
      case 'deadline_reminder':
        return '⏰'
      case 'course_completed':
        return '🎉'
      case 'achievement_unlocked':
        return '🏆'
      case 'system_announcement':
        return '📢'
      default:
        return '🔔'
    }
  }

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications

  const unreadCount = notifications.filter(n => !n.read).length

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
      <div className="flex items-center justify-between">
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
            Varslinger
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {unreadCount > 0 ? `${unreadCount} uleste varsling${unreadCount !== 1 ? 'er' : ''}` : 'Ingen uleste varslinger'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllAsRead}
              variant="secondary"
            >
              <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
              Merk alle som lest
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Alle ({notifications.length})
        </Button>
        <Button
          variant={filter === 'unread' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setFilter('unread')}
        >
          Uleste ({unreadCount})
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4" aria-hidden="true">🔔</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {filter === 'unread' ? 'Ingen uleste varslinger' : 'Ingen varslinger'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {filter === 'unread' 
                  ? 'Alle varslinger er lest' 
                  : 'Du har ikke mottatt noen varslinger ennå'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'transition hover:shadow-md',
                !notification.read && 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-900/20'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0" aria-hidden="true">
                    {getIcon(notification.type)}
                  </span>

                  <div className="flex-1 min-w-0">
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => {
                          if (!notification.read) {
                            handleMarkAsRead(notification.id)
                          }
                        }}
                        className="block"
                      >
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400">
                          {notification.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {notification.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="h-8 w-8 p-0"
                        aria-label="Merk som lest"
                        title="Merk som lest"
                      >
                        <CheckCheck className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(notification.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      aria-label="Slett"
                      title="Slett"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

