import { supabase } from '@/lib/supabase/client'

export type NotificationType = 
  | 'assignment_created' 
  | 'deadline_reminder' 
  | 'course_completed'
  | 'course_updated'
  | 'comment_reply'
  | 'achievement_unlocked'
  | 'system_announcement'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  metadata?: Record<string, unknown>
}

/**
 * Create a new notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([
      {
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
        read: false,
        metadata: params.metadata || {}
      }
    ])
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Create notifications for multiple users (bulk)
 */
export async function createBulkNotifications(
  userIds: string[],
  notification: Omit<CreateNotificationParams, 'userId'>
) {
  const notifications = userIds.map(userId => ({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link || null,
    read: false,
    metadata: notification.metadata || {}
  }))

  const { data, error } = await supabase
    .from('notifications')
    .insert(notifications)
    .select()

  if (error) throw error
  return data
}

/**
 * Mark notification(s) as read
 */
export async function markAsRead(notificationIds: string | string[]) {
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds]

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .in('id', ids)

  if (error) throw error
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) throw error
}

/**
 * Delete notification(s)
 */
export async function deleteNotification(notificationIds: string | string[]) {
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds]

  const { error } = await supabase
    .from('notifications')
    .delete()
    .in('id', ids)

  if (error) throw error
}

/**
 * Get unread count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) throw error
  return count || 0
}

/**
 * Get recent notifications for a user
 */
export async function getNotifications(
  userId: string,
  limit = 20
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * Subscribe to real-time notifications
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new as Notification)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Browser does not support notifications')
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission
  }

  return Notification.permission
}

/**
 * Show browser notification
 */
export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications')
    return
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/logo.png',
      badge: '/logo.png',
      ...options
    })

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000)

    return notification
  }
}

/**
 * Helper to create deadline reminder notifications
 */
export async function createDeadlineReminder(
  userId: string,
  programTitle: string,
  daysRemaining: number,
  programId: string
) {
  const urgencyLevel = daysRemaining <= 1 ? '🔴' : daysRemaining <= 3 ? '🟡' : '🔵'
  
  return createNotification({
    userId,
    type: 'deadline_reminder',
    title: `${urgencyLevel} Frist nærmer seg`,
    message: `Du har ${daysRemaining} dag${daysRemaining !== 1 ? 'er' : ''} igjen på "${programTitle}"`,
    link: `/programs/${programId}`,
    metadata: {
      programId,
      daysRemaining
    }
  })
}

/**
 * Helper to notify about new assignment
 */
export async function notifyNewAssignment(
  userId: string,
  programTitle: string,
  deadlineDays: number,
  programId: string
) {
  return createNotification({
    userId,
    type: 'assignment_created',
    title: '📚 Nytt kurs tildelt',
    message: `Du har fått tildelt "${programTitle}". Frist: ${deadlineDays} dager`,
    link: `/programs/${programId}`,
    metadata: {
      programId,
      deadlineDays
    }
  })
}

/**
 * Helper to notify about course completion
 */
export async function notifyCourseCompleted(
  userId: string,
  programTitle: string,
  programId: string
) {
  return createNotification({
    userId,
    type: 'course_completed',
    title: '🎉 Gratulerer!',
    message: `Du har fullført "${programTitle}"`,
    link: `/programs/${programId}`,
    metadata: {
      programId
    }
  })
}

