'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
  showBrowserNotification,
  type Notification
} from '@/lib/services/notifications'
import Link from 'next/link'
import { toast } from 'sonner'

interface NotificationDropdownProps {
  userId: string
  className?: string
}

export function NotificationDropdown({ userId, className }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(userId, 20),
        getUnreadCount(userId)
      ])
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Kunne ikke laste varslinger')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchNotifications()

    // Subscribe to real-time notifications
    const unsubscribe = subscribeToNotifications(userId, (newNotification) => {
      setNotifications(prev => [newNotification, ...prev])
      setUnreadCount(prev => prev + 1)

      // Show browser notification
      showBrowserNotification(newNotification.title, {
        body: newNotification.message,
        tag: newNotification.id,
        requireInteraction: false
      })

      // Show toast
      toast.info(newNotification.title, {
        description: newNotification.message
      })
    })

    return () => {
      unsubscribe()
    }
  }, [userId, fetchNotifications])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking as read:', error)
      toast.error('Kunne ikke markere som lest')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead(userId)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('Alle varslinger markert som lest')
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Kunne ikke markere alle som lest')
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      const notification = notifications.find(n => n.id === notificationId)
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      toast.success('Varsling slettet')
    } catch (error) {
      console.error('Error deleting notification:', error)
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

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        aria-label={`Varslinger (${unreadCount} uleste)`}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown panel */}
          <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Varslinger
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs"
                    aria-label="Merk alle som lest"
                  >
                    <CheckCheck className="mr-1 h-4 w-4" aria-hidden="true" />
                    Merk alle som lest
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  aria-label="Lukk varslinger"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Notifications list */}
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Laster varslinger...
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="mx-auto mb-3 h-12 w-12 text-gray-400" aria-hidden="true" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ingen varslinger ennå
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'border-b border-gray-100 p-4 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50',
                      !notification.read && 'bg-primary-50 dark:bg-primary-900/20'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <span className="text-2xl" aria-hidden="true">
                        {getIcon(notification.type)}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {notification.link ? (
                          <Link
                            href={notification.link}
                            onClick={() => {
                              if (!notification.read) {
                                handleMarkAsRead(notification.id)
                              }
                              setIsOpen(false)
                            }}
                            className="block"
                          >
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {notification.title}
                            </h4>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                              {notification.message}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {formatRelativeTime(notification.created_at)}
                            </p>
                          </Link>
                        ) : (
                          <>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {notification.title}
                            </h4>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                              {notification.message}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {formatRelativeTime(notification.created_at)}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="h-8 w-8 p-0"
                            aria-label="Merk som lest"
                            title="Merk som lest"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          aria-label="Slett varsling"
                          title="Slett varsling"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 p-3 text-center dark:border-gray-800">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  Se alle varslinger
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

