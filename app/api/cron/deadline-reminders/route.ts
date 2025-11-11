import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Cron job to send deadline reminders
 * Schedule in Vercel: 0 8 * * * (daily at 8 AM UTC)
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate dates for 7, 3, and 1 day reminders
    const reminderDates = [
      new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
      new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
      new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)  // 1 day
    ]

    let totalNotifications = 0

    for (const reminderDate of reminderDates) {
      const dateStart = new Date(reminderDate)
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(reminderDate)
      dateEnd.setHours(23, 59, 59, 999)

      // Get all assignments with deadlines matching this reminder date
      const { data: assignments, error } = await supabaseAdmin
        .from('user_programs')
        .select(`
          user_id,
          program_id,
          deadline,
          completed,
          programs!inner (
            title
          )
        `)
        .eq('completed', false)
        .gte('deadline', dateStart.toISOString())
        .lte('deadline', dateEnd.toISOString())

      if (error) throw error

      if (!assignments || assignments.length === 0) continue

      // Calculate days remaining
      const daysRemaining = Math.ceil((reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Create notifications for each assignment
      const notifications = assignments.map((assignment: any) => {
        const urgencyLevel = daysRemaining <= 1 ? '🔴' : daysRemaining <= 3 ? '🟡' : '🔵'
        
        return {
          user_id: assignment.user_id,
          type: 'deadline_reminder',
          title: `${urgencyLevel} Frist nærmer seg`,
          message: `Du har ${daysRemaining} dag${daysRemaining !== 1 ? 'er' : ''} igjen på "${assignment.programs.title}"`,
          link: `/programs/${assignment.program_id}`,
          read: false,
          metadata: {
            programId: assignment.program_id,
            daysRemaining,
            deadline: assignment.deadline
          }
        }
      })

      // Insert notifications in batch
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications)

      if (insertError) throw insertError

      totalNotifications += notifications.length

      // Also check user preferences and send emails if enabled
      const userIdsSet = new Set(assignments.map((a: any) => a.user_id))
      const userIds = Array.from(userIdsSet)
      
      const { data: preferences } = await supabaseAdmin
        .from('notification_preferences')
        .select('user_id, email_notifications, deadline_reminders')
        .in('user_id', userIds)
        .eq('deadline_reminders', true)
        .eq('email_notifications', true)

      if (preferences && preferences.length > 0) {
        // Get user emails
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name')
          .in('id', preferences.map(p => p.user_id))

        // TODO: Send emails via email service (e.g., Resend, SendGrid)
        // For now, we log that emails would be sent
        console.log(`Would send ${users?.length || 0} deadline reminder emails for ${daysRemaining} day(s)`)
      }
    }

    // Also check for overdue assignments
    const { data: overdueAssignments, error: overdueError } = await supabaseAdmin
      .from('user_programs')
      .select(`
        user_id,
        program_id,
        deadline,
        completed,
        programs!inner (
          title
        )
      `)
      .eq('completed', false)
      .lt('deadline', today.toISOString())

    if (overdueError) throw overdueError

    if (overdueAssignments && overdueAssignments.length > 0) {
      const overdueNotifications = overdueAssignments.map((assignment: any) => ({
        user_id: assignment.user_id,
        type: 'deadline_reminder',
        title: '🚨 Fristen har gått ut',
        message: `Fristen for "${assignment.programs.title}" har gått ut. Fullfør kurset snarest.`,
        link: `/programs/${assignment.program_id}`,
        read: false,
        metadata: {
          programId: assignment.program_id,
          overdue: true,
          deadline: assignment.deadline
        }
      }))

      const { error: overdueInsertError } = await supabaseAdmin
        .from('notifications')
        .insert(overdueNotifications)

      if (overdueInsertError) throw overdueInsertError

      totalNotifications += overdueNotifications.length
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${totalNotifications} deadline reminders`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in deadline reminders cron:', error)
    return NextResponse.json(
      { error: 'Failed to send deadline reminders' },
      { status: 500 }
    )
  }
}

