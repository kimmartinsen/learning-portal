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
        .from('program_assignments')
        .select(`
          assigned_to_user_id,
          program_id,
          due_date,
          status,
          training_programs!inner (
            title,
            instructor_id
          )
        `)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .gte('due_date', dateStart.toISOString())
        .lte('due_date', dateEnd.toISOString())
        .not('assigned_to_user_id', 'is', null)

      if (error) throw error

      if (!assignments || assignments.length === 0) continue

      // Calculate days remaining
      const daysRemaining = Math.ceil((reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Create notifications for each assignment
      const notifications = assignments.map((assignment: any) => {
        const urgencyLevel = daysRemaining <= 1 ? '🔴' : daysRemaining <= 3 ? '🟡' : '🔵'
        const trainingProgram = Array.isArray(assignment.training_programs) 
          ? assignment.training_programs[0] 
          : assignment.training_programs
        
        return {
          user_id: assignment.assigned_to_user_id,
          type: 'deadline_reminder',
          title: `${urgencyLevel} Frist nærmer seg`,
          message: `Du har ${daysRemaining} dag${daysRemaining !== 1 ? 'er' : ''} igjen på "${trainingProgram?.title}"`,
          link: `/programs/${assignment.program_id}`,
          read: false,
          metadata: {
            programId: assignment.program_id,
            daysRemaining,
            deadline: assignment.due_date
          }
        }
      })

      // Insert notifications in batch
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications)

      if (insertError) throw insertError

      totalNotifications += notifications.length
      
      // Send notifications to instructors about their courses' upcoming deadlines
      // Group assignments by instructor and program
      const instructorPrograms = new Map<string, Map<string, any[]>>()
      
      for (const assignment of assignments) {
        const trainingProgram = Array.isArray(assignment.training_programs) 
          ? assignment.training_programs[0] 
          : assignment.training_programs
        const instructorId = trainingProgram?.instructor_id
        if (!instructorId) continue
        
        if (!instructorPrograms.has(instructorId)) {
          instructorPrograms.set(instructorId, new Map())
        }
        
        const programs = instructorPrograms.get(instructorId)!
        if (!programs.has(assignment.program_id)) {
          programs.set(assignment.program_id, [])
        }
        
        programs.get(assignment.program_id)!.push(assignment)
      }
      
      // Create instructor notifications
      const instructorNotifications = []
      for (const [instructorId, programs] of Array.from(instructorPrograms.entries())) {
        for (const [programId, programAssignments] of Array.from(programs.entries())) {
          const trainingProgram = Array.isArray(programAssignments[0].training_programs)
            ? programAssignments[0].training_programs[0]
            : programAssignments[0].training_programs
          const programTitle = trainingProgram?.title
          const userCount = programAssignments.length
          const urgencyLevel = daysRemaining <= 1 ? '🔴' : daysRemaining <= 3 ? '🟡' : '🔵'
          
          // Get user names for better context
          const userIds = programAssignments.map(a => a.assigned_to_user_id)
          const { data: users } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .in('id', userIds)
          
          const userNames = users?.map(u => u.full_name).join(', ') || 'brukere'
          
          instructorNotifications.push({
            user_id: instructorId,
            type: 'deadline_reminder',
            title: `${urgencyLevel} Frist nærmer seg for ditt kurs`,
            message: `${userCount} bruker(e) har ${daysRemaining} dag${daysRemaining !== 1 ? 'er' : ''} igjen på "${programTitle}": ${userNames}`,
            link: `/programs/${programId}`,
            read: false,
            metadata: {
              programId,
              daysRemaining,
              userCount,
              isInstructorNotification: true
            }
          })
        }
      }
      
      if (instructorNotifications.length > 0) {
        const { error: instructorInsertError } = await supabaseAdmin
          .from('notifications')
          .insert(instructorNotifications)
        
        if (instructorInsertError) throw instructorInsertError
        
        totalNotifications += instructorNotifications.length
      }

      // Also check user preferences and send emails if enabled
      const userIdsSet = new Set(assignments.map((a: any) => a.assigned_to_user_id))
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
      .from('program_assignments')
      .select(`
        assigned_to_user_id,
        program_id,
        due_date,
        status,
        training_programs!inner (
          title,
          instructor_id
        )
      `)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .neq('status', 'overdue')
      .lt('due_date', today.toISOString())
      .not('assigned_to_user_id', 'is', null)

    if (overdueError) throw overdueError

    if (overdueAssignments && overdueAssignments.length > 0) {
      const overdueNotifications = overdueAssignments.map((assignment: any) => {
        const trainingProgram = Array.isArray(assignment.training_programs) 
          ? assignment.training_programs[0] 
          : assignment.training_programs
        
        return {
          user_id: assignment.assigned_to_user_id,
          type: 'deadline_reminder',
          title: '🚨 Fristen har gått ut',
          message: `Fristen for "${trainingProgram?.title}" har gått ut. Fullfør kurset snarest.`,
          link: `/programs/${assignment.program_id}`,
          read: false,
          metadata: {
            programId: assignment.program_id,
            overdue: true,
            deadline: assignment.due_date
          }
        }
      })

      const { error: overdueInsertError } = await supabaseAdmin
        .from('notifications')
        .insert(overdueNotifications)

      if (overdueInsertError) throw overdueInsertError

      totalNotifications += overdueNotifications.length
      
      // Send notifications to instructors about overdue assignments
      const instructorOverduePrograms = new Map<string, Map<string, any[]>>()
      
      for (const assignment of overdueAssignments) {
        const trainingProgram = Array.isArray(assignment.training_programs) 
          ? assignment.training_programs[0] 
          : assignment.training_programs
        const instructorId = trainingProgram?.instructor_id
        if (!instructorId) continue
        
        if (!instructorOverduePrograms.has(instructorId)) {
          instructorOverduePrograms.set(instructorId, new Map())
        }
        
        const programs = instructorOverduePrograms.get(instructorId)!
        if (!programs.has(assignment.program_id)) {
          programs.set(assignment.program_id, [])
        }
        
        programs.get(assignment.program_id)!.push(assignment)
      }
      
      // Create instructor overdue notifications
      const instructorOverdueNotifications = []
      for (const [instructorId, programs] of Array.from(instructorOverduePrograms.entries())) {
        for (const [programId, programAssignments] of Array.from(programs.entries())) {
          const trainingProgram = Array.isArray(programAssignments[0].training_programs)
            ? programAssignments[0].training_programs[0]
            : programAssignments[0].training_programs
          const programTitle = trainingProgram?.title
          const userCount = programAssignments.length
          
          // Get user names
          const userIds = programAssignments.map(a => a.assigned_to_user_id)
          const { data: users } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .in('id', userIds)
          
          const userNames = users?.map(u => u.full_name).join(', ') || 'brukere'
          
          instructorOverdueNotifications.push({
            user_id: instructorId,
            type: 'deadline_reminder',
            title: '🚨 Forsinket frist for ditt kurs',
            message: `${userCount} bruker(e) har overskredet fristen for "${programTitle}": ${userNames}`,
            link: `/programs/${programId}`,
            read: false,
            metadata: {
              programId,
              overdue: true,
              userCount,
              isInstructorNotification: true
            }
          })
        }
      }
      
      if (instructorOverdueNotifications.length > 0) {
        const { error: instructorOverdueInsertError } = await supabaseAdmin
          .from('notifications')
          .insert(instructorOverdueNotifications)
        
        if (instructorOverdueInsertError) throw instructorOverdueInsertError
        
        totalNotifications += instructorOverdueNotifications.length
      }
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

