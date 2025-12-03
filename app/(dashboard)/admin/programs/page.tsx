'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Users,
  Clock,
  Settings,
  Tag,
  ChevronRight,
  ArrowUpDown,
  UserPlus,
  Network,
  Folder,
  FolderOpen
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EnhancedTrainingProgram, Theme, Topic } from '@/types/enhanced-database.types'
import { ThemeForm, type ThemeFormData } from '@/components/admin/programs/ThemeForm'
import { AssignmentSelector } from '@/components/admin/AssignmentSelector'

interface User {
  id: string
  role: string
  company_id: string
}

interface Instructor {
  id: string
  full_name: string
}

export default function AdminProgramsPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<EnhancedTrainingProgram[]>([])
  const [themes, setThemes] = useState<Theme[]>([]) // Themes = Programmer
  const [topics, setTopics] = useState<Topic[]>([]) // Topics = Tema (høyeste nivå)
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProgram, setEditingProgram] = useState<EnhancedTrainingProgram | null>(null)
  const [user, setUser] = useState<User | null>(null)
  
  // Topic (Tema) form state
  const [showTopicForm, setShowTopicForm] = useState(false)
  const [topicFormData, setTopicFormData] = useState({ name: '', description: '' })
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  
  const [showThemeForm, setShowThemeForm] = useState(false)
  const [themeFormData, setThemeFormData] = useState<ThemeFormData>({
    name: '',
    description: '',
    topic_id: null
  })
  const [selectedTopicIdForTheme, setSelectedTopicIdForTheme] = useState<string | null>(null)
  const [creatingTheme, setCreatingTheme] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  
  // State for assigning theme to users/departments
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningTheme, setAssigningTheme] = useState<Theme | null>(null)
  const [assignSelection, setAssignSelection] = useState<{
    type: 'department' | 'individual'
    departmentIds: string[]
    userIds: string[]
  }>({
    type: 'department',
    departmentIds: [],
    userIds: []
  })
  const [assigning, setAssigning] = useState(false)
  
  // Store initial assignments to calculate removals
  const [initialAssignSelection, setInitialAssignSelection] = useState<{
    departmentIds: string[]
    userIds: string[]
  }>({ departmentIds: [], userIds: [] })
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    themeId: '',
    instructorId: '',
    courseType: 'e-course' as 'e-course' | 'physical-course',
    deadlineDays: 14,
    repetitionEnabled: false,
    repetitionInterval: 12,
    sortOrder: 0, // Nytt felt for rekkefølge
    assignment: {
      type: 'department' as 'department' | 'individual',
      departmentIds: [] as string[],
      userIds: [] as string[]
    }
  })

  useEffect(() => {
    fetchUserAndData()
  }, [])
  
  // Auto-calculate sort_order when theme is selected for new programs
  useEffect(() => {
    if (!editingProgram && formData.themeId && user) {
      const calculateNextSortOrder = async () => {
        const { data: existingPrograms } = await supabase
          .from('training_programs')
          .select('sort_order')
          .eq('theme_id', formData.themeId)
          .order('sort_order', { ascending: false })
          .limit(1)
        
        if (existingPrograms && existingPrograms.length > 0) {
          const maxSortOrder = existingPrograms[0].sort_order
          const nextSortOrder = (maxSortOrder != null && maxSortOrder >= 0) ? maxSortOrder + 1 : 0
          setFormData(prev => ({ ...prev, sortOrder: nextSortOrder }))
        } else {
          setFormData(prev => ({ ...prev, sortOrder: 0 }))
        }
      }
      calculateNextSortOrder()
    }
  }, [formData.themeId, editingProgram, user])

  const fetchUserAndData = async () => {
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        toast.error('Ikke autorisert')
        return
      }

      setUser(profile)
      await Promise.all([
        fetchPrograms(profile.company_id),
        fetchThemes(profile.company_id),
        fetchTopics(profile.company_id),
        fetchInstructors(profile.company_id)
      ])
    } catch (error: any) {
      toast.error('Kunne ikke hente data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPrograms = async (companyId: string) => {
    const { data, error } = await supabase
      .from('training_programs')
      .select(`
        *,
        theme:themes(id, name),
        instructor:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    // Ensure course_type defaults to 'e-course' for existing courses
    setPrograms((data || []).map(p => ({
      ...p,
      course_type: p.course_type || 'e-course'
    })))
  }

  const fetchThemes = async (companyId: string) => {
    const { data, error } = await supabase
      .from('themes')
      .select('*, topic:topics(id, name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error) throw error
    setThemes(data || [])
  }

  const fetchTopics = async (companyId: string) => {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('company_id', companyId)
      .order('order_index', { ascending: true })

    if (error) {
      // Topics-tabellen eksisterer kanskje ikke ennå
      console.log('Topics not available yet:', error.message)
      setTopics([])
      return
    }
    setTopics(data || [])
  }


  const fetchInstructors = async (companyId: string) => {
    // Hent alle brukere og admins - alle kan være instruktører
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .in('role', ['admin', 'user'])
      .order('full_name')

    if (error) throw error
    setInstructors(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      // For new programs in a theme, automatically set next sort_order
      let sortOrder = formData.sortOrder
      if (!editingProgram && formData.themeId) {
        const { data: existingPrograms } = await supabase
          .from('training_programs')
          .select('sort_order')
          .eq('theme_id', formData.themeId)
          .order('sort_order', { ascending: false })
          .limit(1)
        
        if (existingPrograms && existingPrograms.length > 0) {
          const maxSortOrder = existingPrograms[0].sort_order
          sortOrder = (maxSortOrder != null && maxSortOrder >= 0) ? maxSortOrder + 1 : 0
        } else {
          sortOrder = 0 // First course in theme
        }
      }
      
      const programData = {
        title: formData.title,
        description: formData.description || null,
        theme_id: formData.themeId || null,
        instructor_id: formData.instructorId || null,
        course_type: formData.courseType,
        deadline_days: formData.deadlineDays,
        repetition_enabled: formData.repetitionEnabled,
        repetition_interval_months: formData.repetitionEnabled ? formData.repetitionInterval : null,
        sort_order: sortOrder,
        company_id: user.company_id
      }

      let programId: string

      if (editingProgram) {
        // Update existing program
        const { error } = await supabase
          .from('training_programs')
          .update(programData)
          .eq('id', editingProgram.id)

        if (error) throw error
        programId = editingProgram.id
        
        // Handle removal of assignments when editing
        
        // 1. Remove department assignments
        const { data: existingDeptAssignments } = await supabase
          .from('program_assignments')
          .select('id, assigned_to_department_id')
          .eq('program_id', programId)
          .not('assigned_to_department_id', 'is', null)
        
        // Find departments that were removed (existed before but not in form now)
        const removedDepartmentIds = (existingDeptAssignments || [])
          .map(a => a.assigned_to_department_id)
          .filter(deptId => deptId && !formData.assignment.departmentIds.includes(deptId))
        
        // Delete department assignments and their auto-assigned user assignments
        for (const deptId of removedDepartmentIds) {
          if (!deptId) continue;
          // 1. Get users in this department from user_departments
          const { data: deptUsers } = await supabase
            .from('user_departments')
            .select('user_id')
            .eq('department_id', deptId)
          
          // 2. Delete the department assignment itself
          await supabase
            .from('program_assignments')
            .delete()
            .eq('program_id', programId)
            .eq('assigned_to_department_id', deptId)
          
          // 3. Delete auto-assigned user assignments for this department's users
          if (deptUsers && deptUsers.length > 0) {
            await supabase
              .from('program_assignments')
              .delete()
              .eq('program_id', programId)
              .in('assigned_to_user_id', deptUsers.map(u => u.user_id))
              .eq('is_auto_assigned', true)
          }
        }
        
        // 2. Remove individual user assignments
        const { data: existingUserAssignments } = await supabase
          .from('program_assignments')
          .select('id, assigned_to_user_id')
          .eq('program_id', programId)
          .not('assigned_to_user_id', 'is', null)
          .eq('is_auto_assigned', false)
        
        // Find users that were removed (existed before but not in form now)
        const removedUserIds = (existingUserAssignments || [])
          .map(a => a.assigned_to_user_id)
          .filter(userId => userId && !formData.assignment.userIds.includes(userId))
        
        // Delete individual user assignments
        if (removedUserIds.length > 0) {
          const validRemovedUserIds = removedUserIds.filter((id): id is string => id !== null);
          if (validRemovedUserIds.length > 0) {
            await supabase
              .from('program_assignments')
              .delete()
              .eq('program_id', programId)
              .in('assigned_to_user_id', validRemovedUserIds)
              .eq('is_auto_assigned', false)
          }
        }
        
        toast.success('Kurs oppdatert!')
      } else {
        // Create new program
        const { data, error } = await supabase
          .from('training_programs')
          .insert([programData])
          .select()
          .single()

        if (error) throw error
        programId = data.id
        toast.success('Kurs opprettet!')
      }

      // Create assignments
      if (formData.assignment.departmentIds.length > 0 || formData.assignment.userIds.length > 0) {
        let newlyAssignedUserIds: string[] = []
        
        // 1. Handle Department assignments
        if (formData.assignment.departmentIds.length > 0) {
          for (const departmentId of formData.assignment.departmentIds) {
            // Check if department assignment already exists
            const { data: existingDeptAssignment } = await supabase
              .from('program_assignments')
              .select('id')
              .eq('program_id', programId)
              .eq('assigned_to_department_id', departmentId)
              .single()
            
            if (!existingDeptAssignment) {
              // Get users in this department BEFORE assignment to know who was already assigned
              const { data: deptUsers } = await supabase
                .from('user_departments')
                .select('user_id')
                .eq('department_id', departmentId)

              // Get existing user assignments for this program
              const { data: existingUserAssignments } = await supabase
                .from('program_assignments')
                .select('assigned_to_user_id')
                .eq('program_id', programId)
                .in('assigned_to_user_id', (deptUsers || []).map(u => u.user_id))

              const alreadyAssignedUserIds = new Set(
                (existingUserAssignments || []).map(a => a.assigned_to_user_id)
              )

              // FIKSET: Bruk direkte INSERT i stedet for RPC (omgår database-funksjon problemer)
              const dueDate = new Date()
              dueDate.setDate(dueDate.getDate() + (formData.deadlineDays || 14))

              // 1. Opprett avdelingstildeling
              const { error: deptInsertError } = await supabase
                .from('program_assignments')
                .insert({
                  program_id: programId,
                  assigned_to_department_id: departmentId,
                  assigned_by: user.id,
                  due_date: dueDate.toISOString(),
                  notes: editingProgram ? 'Oppdatert kurs' : 'Nytt kurs',
                  status: 'assigned'
                })

              if (deptInsertError) {
                console.error('Error creating department assignment:', deptInsertError)
                throw new Error(`Kunne ikke tildele til avdeling: ${deptInsertError.message}`)
              }

              // 2. Opprett individuelle brukertildelinger for alle brukere i avdelingen
              if (deptUsers && deptUsers.length > 0) {
                const userAssignments = deptUsers
                  .filter(u => !alreadyAssignedUserIds.has(u.user_id))
                  .map(u => ({
                    program_id: programId,
                    assigned_to_user_id: u.user_id,
                    assigned_by: user.id,
                    due_date: dueDate.toISOString(),
                    notes: editingProgram ? 'Oppdatert kurs' : 'Nytt kurs',
                    status: 'assigned',
                    is_auto_assigned: true
                  }))

                if (userAssignments.length > 0) {
                  const { error: userInsertError } = await supabase
                    .from('program_assignments')
                    .insert(userAssignments)

                  if (userInsertError) {
                    console.error('Error creating user assignments:', userInsertError)
                    toast.warning('Avdeling tildelt, men noen brukertildelinger feilet')
                  } else {
                    // Legg til brukere i notifikasjonslisten (kun én gang!)
                    newlyAssignedUserIds.push(...userAssignments.map(a => a.assigned_to_user_id!))
                  }
                }
              }
            }
          }
        }

        // 2. Handle Individual assignments
        if (formData.assignment.userIds.length > 0) {
          for (const userId of formData.assignment.userIds) {
            // Check if user already has this course (ANY assignment, manual or auto)
            const { data: existing } = await supabase
              .from('program_assignments')
              .select('id')
              .eq('program_id', programId)
              .eq('assigned_to_user_id', userId)
              .single()

            if (!existing) {
              // FIKSET: Bruk direkte INSERT i stedet for RPC (omgår database-funksjon problemer)
              const dueDate = new Date()
              dueDate.setDate(dueDate.getDate() + (formData.deadlineDays || 14))

              const { error: directInsertError } = await supabase
                .from('program_assignments')
                .insert({
                  program_id: programId,
                  assigned_to_user_id: userId,
                  assigned_by: user.id,
                  due_date: dueDate.toISOString(),
                  notes: editingProgram ? 'Oppdatert kurs' : 'Nytt kurs',
                  status: 'assigned',
                  is_auto_assigned: false
                })

              if (directInsertError) {
                console.error('Error creating user assignment:', directInsertError)
                throw new Error(`Kunne ikke tildele til bruker: ${directInsertError.message}`)
              }

              newlyAssignedUserIds.push(userId)
            }
          }
        }
        
        // Send notifications to newly assigned users ONLY
        // newlyAssignedUserIds contains only users who were actually assigned (not duplicates)
        if (newlyAssignedUserIds.length > 0) {
          console.log('Creating notifications for newly assigned users:', newlyAssignedUserIds)
          
          const notifications = newlyAssignedUserIds.map(userId => ({
            user_id: userId,
            type: 'assignment_created',
            title: '📚 Nytt kurs tildelt',
            message: `Du har fått tildelt "${formData.title}". Frist: ${formData.deadlineDays} dager`,
            link: `/programs/${programId}`,
            read: false,
            metadata: {
              programId,
              deadlineDays: formData.deadlineDays
            }
          }))
          
          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notifications)
            .select()
          
          if (notifError) {
            console.error('Error creating notifications:', notifError)
            toast.error('Kurset ble opprettet, men varsling feilet: ' + notifError.message)
          } else {
            toast.success(`Varsling sendt til ${newlyAssignedUserIds.length} bruker(e)`)
          }
          
          // Send notification to instructor if assigned
          if (formData.instructorId && formData.instructorId !== user.id) {
            const instructorNotification = {
              user_id: formData.instructorId,
              type: 'course_updated',
              title: '👥 Brukere tildelt til ditt kurs',
              message: `${newlyAssignedUserIds.length} bruker(e) har fått tildelt "${formData.title}"`,
              link: `/programs/${programId}`,
              read: false,
              metadata: {
                programId,
                assignedCount: newlyAssignedUserIds.length,
                deadlineDays: formData.deadlineDays
              }
            }
            
            const { error: instructorNotifError } = await supabase
              .from('notifications')
              .insert([instructorNotification])
            
            if (instructorNotifError) {
              console.error('Error creating instructor notification:', instructorNotifError)
            }
          }
        }
      }

      resetForm()
      fetchPrograms(user.company_id)
      
      // Trigger refresh for all pages (including My Learning)
      router.refresh()
    } catch (error: any) {
      console.error('Error creating/updating course:', error)
      // Vis mer detaljert feilmelding
      const errorMessage = error.message || 'Ukjent feil oppstod'
      toast.error(`Kunne ikke opprette/oppdatere kurs: ${errorMessage}`)
      // Lukk ikke modalen ved feil, slik at brukeren kan se feilmeldingen og prøve igjen
    }
  }

  const handleEdit = async (program: EnhancedTrainingProgram) => {
    setEditingProgram(program)
    
    // Init form with basic data
    setFormData({
      title: program.title,
      description: program.description || '',
      themeId: program.theme_id || '',
      instructorId: program.instructor_id || '',
      courseType: (program.course_type as 'e-course' | 'physical-course') || 'e-course',
      deadlineDays: program.deadline_days || 14,
      repetitionEnabled: program.repetition_enabled || false,
      repetitionInterval: program.repetition_interval_months || 12,
      sortOrder: program.sort_order || 0,
      assignment: {
        type: 'department',
        departmentIds: [],
        userIds: []
      }
    })
    
    setShowForm(true)

    // Fetch existing assignments
    try {
      // 1. Get department assignments
      const { data: deptAssignments } = await supabase
        .from('program_assignments')
        .select('assigned_to_department_id')
        .eq('program_id', program.id)
        .not('assigned_to_department_id', 'is', null)

      // 2. Get individual assignments (excluding auto-assigned ones)
      const { data: userAssignments } = await supabase
        .from('program_assignments')
        .select('assigned_to_user_id')
        .eq('program_id', program.id)
        .not('assigned_to_user_id', 'is', null)
        .eq('is_auto_assigned', false)

      // Update form with fetched assignments
      setFormData(prev => ({
        ...prev,
        assignment: {
          type: (deptAssignments && deptAssignments.length > 0) ? 'department' : 'individual',
          departmentIds: deptAssignments?.map(a => a.assigned_to_department_id).filter(id => id !== null) as string[] || [],
          userIds: userAssignments?.map(a => a.assigned_to_user_id).filter(id => id !== null) as string[] || []
        }
      }))
    } catch (error) {
      console.error('Error fetching assignments:', error)
      toast.error('Kunne ikke hente eksisterende tildelinger')
    }
  }

  const handleDelete = async (programId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette kurset?')) return

    try {
      const { error } = await supabase
        .from('training_programs')
        .delete()
        .eq('id', programId)

      if (error) throw error
      toast.success('Kurs slettet!')
      fetchPrograms(user!.company_id)
      
      // VIKTIG: Trigger refresh av alle Server Components (inkludert Min opplæring)
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke slette kurs: ' + error.message)
    }
  }

  const handleDeleteTheme = async (themeId: string) => {
    // First check if theme has any courses
    const themePrograms = programs.filter(p => p.theme_id === themeId)
    
    if (themePrograms.length > 0) {
      const courseCount = themePrograms.length
      if (!confirm(
        `Dette programmet inneholder ${courseCount} kurs. ` +
        `Alle kursene vil bli flyttet til "Uten program". ` +
        `Er du sikker på at du vil slette programmet?`
      )) return
    } else {
      if (!confirm('Er du sikker på at du vil slette dette programmet?')) return
    }

    try {
      // Delete the theme
      // Note: theme_id in training_programs has ON DELETE SET NULL, so courses will be preserved
      const { error } = await supabase
        .from('themes')
        .delete()
        .eq('id', themeId)

      if (error) throw error
      
      toast.success('Program slettet!')
      await Promise.all([
        fetchPrograms(user!.company_id),
        fetchThemes(user!.company_id)
      ])
      
      // VIKTIG: Trigger refresh av alle Server Components
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke slette program: ' + error.message)
    }
  }

  const handleEditModules = (program: EnhancedTrainingProgram) => {
    // Navigate to module builder
    window.location.href = `/admin/programs/${program.id}/modules`
  }

  // === TOPIC (TEMA) FUNCTIONS ===
  const handleCreateTopic = async () => {
    if (!user || !topicFormData.name.trim()) {
      toast.error('Navn på tema er påkrevd')
      return
    }

    setCreatingTopic(true)
    try {
      const { error } = await supabase
        .from('topics')
        .insert([{
          company_id: user.company_id,
          name: topicFormData.name.trim(),
          description: topicFormData.description.trim() || null,
          order_index: topics.length
        }])

      if (error) throw error

      toast.success('Tema opprettet!')
      setShowTopicForm(false)
      setTopicFormData({ name: '', description: '' })
      fetchTopics(user.company_id)
    } catch (error: any) {
      toast.error('Kunne ikke opprette tema: ' + error.message)
    } finally {
      setCreatingTopic(false)
    }
  }

  const handleUpdateTopic = async () => {
    if (!user || !editingTopic || !topicFormData.name.trim()) {
      toast.error('Navn på tema er påkrevd')
      return
    }

    setCreatingTopic(true)
    try {
      const { error } = await supabase
        .from('topics')
        .update({
          name: topicFormData.name.trim(),
          description: topicFormData.description.trim() || null
        })
        .eq('id', editingTopic.id)

      if (error) throw error

      toast.success('Tema oppdatert!')
      setShowTopicForm(false)
      setEditingTopic(null)
      setTopicFormData({ name: '', description: '' })
      fetchTopics(user.company_id)
    } catch (error: any) {
      toast.error('Kunne ikke oppdatere tema: ' + error.message)
    } finally {
      setCreatingTopic(false)
    }
  }

  const handleDeleteTopic = async (topicId: string) => {
    // Sjekk om temaet har programmer
    const topicThemes = themes.filter(t => t.topic_id === topicId)
    
    if (topicThemes.length > 0) {
      if (!confirm(
        `Dette temaet inneholder ${topicThemes.length} programmer. ` +
        `Alle programmene vil bli flyttet til "Uten tema". ` +
        `Er du sikker på at du vil slette temaet?`
      )) return
    } else {
      if (!confirm('Er du sikker på at du vil slette dette temaet?')) return
    }

    try {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId)

      if (error) throw error

      toast.success('Tema slettet!')
      await Promise.all([
        fetchTopics(user!.company_id),
        fetchThemes(user!.company_id)
      ])
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke slette tema: ' + error.message)
    }
  }

  const handleEditTopic = (topic: Topic) => {
    setEditingTopic(topic)
    setTopicFormData({
      name: topic.name,
      description: topic.description || ''
    })
    setShowTopicForm(true)
  }

  const openThemeFormForTopic = (topicId: string | null) => {
    setSelectedTopicIdForTheme(topicId)
    setThemeFormData({ name: '', description: '', topic_id: topicId })
    setEditingTheme(null)
    setShowThemeForm(true)
  }

  const handleEditTheme = (theme: Theme) => {
    setEditingTheme(theme)
    setThemeFormData({
      name: theme.name,
      description: theme.description || '',
      topic_id: theme.topic_id || null
    })
    setSelectedTopicIdForTheme(theme.topic_id || null)
    setShowThemeForm(true)
  }

  const openCourseFormForTheme = (themeId: string) => {
    setEditingProgram(null)
    setFormData({
      title: '',
      description: '',
      themeId: themeId,
      instructorId: '',
      courseType: 'e-course',
      deadlineDays: 14,
      repetitionEnabled: false,
      repetitionInterval: 12,
      sortOrder: 0,
      assignment: {
        type: 'department',
        departmentIds: [],
        userIds: []
      }
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingProgram(null)
    setFormData({
      title: '',
      description: '',
      themeId: '',
      instructorId: '',
      courseType: 'e-course',
      deadlineDays: 14,
      repetitionEnabled: false,
      repetitionInterval: 12,
      sortOrder: 0,
      assignment: {
        type: 'department',
        departmentIds: [],
        userIds: []
      }
    })
  }

  const resetThemeForm = () => {
    setShowThemeForm(false)
    setThemeFormData({ name: '', description: '', topic_id: null })
    setSelectedTopicIdForTheme(null)
    setEditingTheme(null)
    setCreatingTheme(false)
  }

  const handleCreateOrUpdateTheme = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setCreatingTheme(true)
      
      if (editingTheme) {
        // Oppdater eksisterende program
        const { error } = await supabase
          .from('themes')
          .update({
            name: themeFormData.name,
            description: themeFormData.description || null,
            topic_id: themeFormData.topic_id || null
          })
          .eq('id', editingTheme.id)

        if (error) throw error
        toast.success('Program oppdatert!')
      } else {
        // Opprett nytt program
        const { data, error } = await supabase
          .from('themes')
          .insert([
            {
              name: themeFormData.name,
              description: themeFormData.description || null,
              company_id: user.company_id,
              topic_id: themeFormData.topic_id || selectedTopicIdForTheme || null,
              progression_type: 'flexible'
            }
          ])
          .select()
          .single()

        if (error) throw error

        toast.success('Program opprettet!')
        setFormData((prev) => ({
          ...prev,
          themeId: data?.id || prev.themeId
        }))
      }

      await fetchThemes(user.company_id)
      resetThemeForm()
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCreatingTheme(false)
    }
  }

  // --- New: Assignment Handling for Themes ---

  const handleOpenAssign = async (theme: Theme) => {
    setAssigningTheme(theme)
    // Reset selection first
    setAssignSelection({
      type: 'department',
      departmentIds: [],
      userIds: []
    })
    setInitialAssignSelection({ departmentIds: [], userIds: [] })
    setShowAssignModal(true)

    // Fetch existing assignments for this theme to pre-fill the modal
    // Strategy: Find ALL assignments for ANY program in this theme. 
    try {
      // 1. Find the first program in the theme
      const { data: firstProgram } = await supabase
        .from('training_programs')
        .select('id')
        .eq('theme_id', theme.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      
      if (firstProgram) {
        // 2. Get assignments for this program
        const [deptResponse, userResponse] = await Promise.all([
          supabase
            .from('program_assignments')
            .select('assigned_to_department_id')
            .eq('program_id', firstProgram.id)
            .not('assigned_to_department_id', 'is', null),
          supabase
            .from('program_assignments')
            .select('assigned_to_user_id')
            .eq('program_id', firstProgram.id)
            .not('assigned_to_user_id', 'is', null)
            .eq('is_auto_assigned', false) // Only manual user assignments
        ])

        if (deptResponse.data || userResponse.data) {
          // Remove duplicates using Set
          const currentDeptIds = Array.from(new Set(
            (deptResponse.data || []).map(a => a.assigned_to_department_id).filter(Boolean) as string[]
          ))
          const currentUserIds = Array.from(new Set(
            (userResponse.data || []).map(a => a.assigned_to_user_id).filter(Boolean) as string[]
          ))
          
          setAssignSelection(prev => ({
            ...prev,
            departmentIds: currentDeptIds,
            userIds: currentUserIds
          }))
          
          // Store initial selection to detect removals later
          setInitialAssignSelection({
            departmentIds: currentDeptIds,
            userIds: currentUserIds
          })
        }
      }
    } catch (error) {
      console.error('Error fetching existing theme assignments:', error)
    }
  }

  const handleAssignSubmit = async () => {
    if (!assigningTheme || !user) return
    
    setAssigning(true)
    try {
      // 1. Get all programs in this theme
      const { data: programs } = await supabase
        .from('training_programs')
        .select('id, sort_order')
        .eq('theme_id', assigningTheme.id)
        .order('sort_order', { ascending: true })
      
      if (!programs || programs.length === 0) {
        toast.error('Ingen kurs i dette programmet å tildele')
        return
      }

      let successCount = 0
      let removedCount = 0
      let allAssignedUserIds: string[] = []

      // Calculate removals
      const removedDepartmentIds = initialAssignSelection.departmentIds.filter(id => !assignSelection.departmentIds.includes(id))
      const removedUserIds = initialAssignSelection.userIds.filter(id => !assignSelection.userIds.includes(id))

      // 2. Loop through programs and assign/remove
      const isSequential = assigningTheme.progression_type === 'sequential_auto' || assigningTheme.progression_type === 'sequential_manual'
      
      for (let i = 0; i < programs.length; i++) {
        const program = programs[i]
        const programId = program.id
        
        // --- REMOVALS ---
        
        // Remove department assignments
        for (const deptId of removedDepartmentIds) {
          // 1. Get users in this department
          const { data: deptUsers } = await supabase
            .from('user_departments')
            .select('user_id')
            .eq('department_id', deptId)
          
          // 2. Delete the department assignment itself
          const { error: deptDelError } = await supabase
            .from('program_assignments')
            .delete()
            .eq('program_id', programId)
            .eq('assigned_to_department_id', deptId)
          
          if (!deptDelError) removedCount++

          // 3. Delete auto-assigned user assignments
          if (deptUsers && deptUsers.length > 0) {
            await supabase
              .from('program_assignments')
              .delete()
              .eq('program_id', programId)
              .in('assigned_to_user_id', deptUsers.map(u => u.user_id))
              .eq('is_auto_assigned', true)
          }
        }
        
        // Remove individual assignments
        if (removedUserIds.length > 0) {
           const { error: userDelError } = await supabase
             .from('program_assignments')
             .delete()
             .eq('program_id', programId)
             .in('assigned_to_user_id', removedUserIds)
             .eq('is_auto_assigned', false)
           
           if (!userDelError) removedCount++
        }

        // --- ADDITIONS ---

        // Assign to departments
        if (assignSelection.type === 'department' && assignSelection.departmentIds.length > 0) {
          for (const deptId of assignSelection.departmentIds) {
             // 1. Sjekk om avdelingstildeling allerede eksisterer
             const { data: existingDeptAssignments } = await supabase
                .from('program_assignments')
                .select('id')
                .eq('program_id', programId)
                .eq('assigned_to_department_id', deptId)
                .limit(1)
             
             if (existingDeptAssignments && existingDeptAssignments.length > 0) {
               // Hopp over - allerede tildelt
               continue
             }

             // 2. Get users in dept
             const { data: deptUsers } = await supabase
                .from('user_departments')
                .select('user_id')
                .eq('department_id', deptId)

             if (deptUsers) {
               allAssignedUserIds.push(...deptUsers.map(u => u.user_id))
             }

             // 3. Hent eksisterende brukertildelinger for å unngå duplikater
             const { data: existingUserAssignments } = await supabase
                .from('program_assignments')
                .select('assigned_to_user_id')
                .eq('program_id', programId)
                .in('assigned_to_user_id', (deptUsers || []).map(u => u.user_id))

             const alreadyAssignedUserIds = new Set(
               (existingUserAssignments || []).map(a => a.assigned_to_user_id)
             )

             // 4. Create dept assignment - DIREKTE INSERT
             const { data: program } = await supabase
                .from('training_programs')
                .select('deadline_days')
                .eq('id', programId)
                .single()

             const dueDate = new Date()
             dueDate.setDate(dueDate.getDate() + (program?.deadline_days || 14))

             const { error: deptError } = await supabase
                .from('program_assignments')
                .insert({
                  program_id: programId,
                  assigned_to_department_id: deptId,
                  assigned_by: user.id,
                  due_date: dueDate.toISOString(),
                  notes: 'Del av program-tildeling: ' + assigningTheme.name,
                  status: 'assigned'
                })

             if (!deptError) {
               successCount++

               // 5. Create individual user assignments (kun for brukere som ikke allerede er tildelt)
               if (deptUsers && deptUsers.length > 0) {
                 const userAssignments = deptUsers
                   .filter(u => !alreadyAssignedUserIds.has(u.user_id))
                   .map(u => ({
                     program_id: programId,
                     assigned_to_user_id: u.user_id,
                     assigned_by: user.id,
                     due_date: dueDate.toISOString(),
                     notes: 'Del av program-tildeling: ' + assigningTheme.name,
                     status: 'assigned',
                     is_auto_assigned: true
                   }))

                 if (userAssignments.length > 0) {
                   await supabase
                     .from('program_assignments')
                     .insert(userAssignments)
                 }
               }
             }
          }
        }
        
        // Assign to individuals
        if (assignSelection.type === 'individual' && assignSelection.userIds.length > 0) {
          // Get program deadline
          const { data: program } = await supabase
            .from('training_programs')
            .select('deadline_days')
            .eq('id', programId)
            .single()

          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + (program?.deadline_days || 14))

          for (const userId of assignSelection.userIds) {
             // Sjekk om brukeren allerede har denne tildelingen
             const { data: existingAssignments } = await supabase
                .from('program_assignments')
                .select('id')
                .eq('program_id', programId)
                .eq('assigned_to_user_id', userId)
                .limit(1)
             
             if (existingAssignments && existingAssignments.length > 0) {
               // Hopp over - allerede tildelt
               continue
             }

             allAssignedUserIds.push(userId)

             const { error } = await supabase
                .from('program_assignments')
                .insert({
                  program_id: programId,
                  assigned_to_user_id: userId,
                  assigned_by: user.id,
                  due_date: dueDate.toISOString(),
                  notes: 'Del av program-tildeling: ' + assigningTheme.name,
                  status: 'assigned',
                  is_auto_assigned: false
                })

             if (!error) successCount++
          }
        }
      }
      
      // 3. If sequential, lock non-first programs (only for active assignments)
      if (isSequential && programs.length > 1) {
        const programsToLock = programs.slice(1).map(p => p.id)
        if (programsToLock.length > 0 && allAssignedUserIds.length > 0) {
           await supabase
             .from('program_assignments')
             .update({ status: 'locked' })
             .in('program_id', programsToLock)
             .in('assigned_to_user_id', allAssignedUserIds)
             .eq('status', 'assigned') // Only lock if currently just assigned (not started/completed)
        }
      }

      if (successCount > 0 || removedCount > 0) {
        let msg = 'Program oppdatert.'
        if (removedCount > 0) msg += ` Fjernet tilgang for ${removedCount} mottakere.`
        toast.success(msg)
        
        // Trigger refresh for all pages (including My Learning)
        router.refresh()
      } else {
        toast.info('Ingen endringer i tildelinger')
      }
      
      setShowAssignModal(false)
      setAssigningTheme(null)
    } catch (error: any) {
      console.error('Error assigning program:', error)
      toast.error('Feil under tildeling: ' + error.message)
    } finally {
      setAssigning(false)
    }
  }

  // --- End Assignment Handling ---

  // Group programs by theme, sorter dem basert på sort_order hvis mulig
  const programsByTheme = programs.reduce((acc, program) => {
    const themeId = program.theme_id || 'no-theme'
    if (!acc[themeId]) {
      acc[themeId] = []
    }
    acc[themeId].push(program)
    return acc
  }, {} as Record<string, EnhancedTrainingProgram[]>)

  // Sorter kursene internt i temaene basert på sort_order
  Object.keys(programsByTheme).forEach(themeId => {
    programsByTheme[themeId].sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return (a.sort_order || 0) - (b.sort_order || 0)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  })

  if (loading) {
    return <div className="text-center py-8">Laster...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kursadministrasjon</h1>
          <p className="text-gray-600 dark:text-gray-300">Administrer tema, programmer og kurs for bedriften</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowTopicForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nytt tema
          </Button>
          <Button variant="secondary" onClick={() => setShowThemeForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nytt program
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nytt kurs
          </Button>
        </div>
      </div>

      {/* Topic (Tema) Form Modal */}
      <Modal isOpen={showTopicForm} onClose={() => { setShowTopicForm(false); setEditingTopic(null); setTopicFormData({ name: '', description: '' }) }}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingTopic ? 'Rediger tema' : 'Nytt tema'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tema er det høyeste nivået og kan inneholde flere programmer.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); editingTopic ? handleUpdateTopic() : handleCreateTopic() }} className="space-y-4">
              <Input
                label="Temanavn"
                value={topicFormData.name}
                onChange={(e) => setTopicFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="F.eks. Sikkerhet, Kvalitet, Onboarding"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Beskrivelse (valgfritt)
                </label>
                <textarea
                  value={topicFormData.description}
                  onChange={(e) => setTopicFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  rows={3}
                  placeholder="Beskriv temaet..."
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <Button type="submit" className="flex-1" disabled={creatingTopic}>
                  {creatingTopic ? 'Lagrer...' : (editingTopic ? 'Oppdater tema' : 'Opprett tema')}
                </Button>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => { setShowTopicForm(false); setEditingTopic(null); setTopicFormData({ name: '', description: '' }) }}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Modal>

      {/* Theme Form Modal (Program) */}
      <Modal isOpen={showThemeForm} onClose={resetThemeForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingTheme ? 'Rediger program' : 'Nytt program'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {editingTheme 
                ? 'Oppdater programnavn, beskrivelse eller tema' 
                : 'Opprett et nytt program som kan inneholde flere kurs'}
            </p>
          </CardHeader>
          <CardContent>
            <ThemeForm
              formData={themeFormData}
              isCreating={creatingTheme}
              onSubmit={handleCreateOrUpdateTheme}
              onChange={(data) => setThemeFormData((prev) => ({ ...prev, ...data }))}
              onCancel={resetThemeForm}
              buttonText={editingTheme ? 'Oppdater program' : 'Opprett program'}
              topics={topics}
              showTopicSelector={true}
            />
          </CardContent>
        </Card>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)}>
        <Card className="w-full max-w-lg bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tildel program: {assigningTheme?.name}
            </h3>
            <p className="text-sm text-gray-500">
              Dette vil tildele alle kursene i programmet til de valgte mottakerne.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssignmentSelector
              companyId={user?.company_id || ''}
              onSelectionChange={setAssignSelection}
              selection={assignSelection}
            />
            
            <div className="flex space-x-3 pt-4">
              <Button 
                className="flex-1" 
                onClick={handleAssignSubmit} 
                loading={assigning}
              >
                Lagre tildelinger
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setShowAssignModal(false)} 
                disabled={assigning}
              >
                Avbryt
              </Button>
            </div>
          </CardContent>
        </Card>
      </Modal>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={resetForm} size="lg">
        <Card className="bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingProgram ? 'Rediger kurs' : 'Nytt kurs'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Kurstittel"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                placeholder="F.eks. Sikkerhet på arbeidsplassen"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Beskrivelse
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                  rows={3}
                  placeholder="Beskrivelse av kurset"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Program (Tema)
                </label>
                <select
                  value={formData.themeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, themeId: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="">Velg program (valgfritt)</option>
                  {themes.map(theme => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
                {themes.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <a href="/admin/themes" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                      Opprett programmer først
                    </a> for å organisere kursene
                  </p>
                )}
              </div>
              
              {formData.themeId && (
                 <Input
                  label={editingProgram ? "Rekkefølge i program" : "Rekkefølge i program (tildeles automatisk)"}
                  type="number"
                  value={editingProgram ? formData.sortOrder : formData.sortOrder + 1}
                  onChange={(e) => editingProgram && setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  disabled={!editingProgram}
                  helper={editingProgram 
                    ? "Lavere tall kommer først. Brukes for å styre rekkefølgen hvis programmet er sekvensielt." 
                    : `Dette kurset får automatisk steg ${formData.sortOrder + 1} i programmet.`
                  }
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kurs type
                </label>
                <select
                  value={formData.courseType}
                  onChange={(e) => setFormData(prev => ({ ...prev, courseType: e.target.value as 'e-course' | 'physical-course' }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="e-course">E-kurs (nettbasert)</option>
                  <option value="physical-course">Fysisk kurs (sjekkliste)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formData.courseType === 'e-course' 
                    ? 'E-kurs fungerer som vanlige nettbaserte kurs med moduler.'
                    : 'Fysiske kurs fungerer som sjekklister med punkter som kan sjekkes av instruktører eller admin.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instruktør
                </label>
                <select
                  value={formData.instructorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructorId: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="">Ingen instruktør</option>
                  {instructors.map(instructor => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.full_name}
                    </option>
                  ))}
                </select>
                {formData.courseType === 'physical-course' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Instruktører kan bekrefte at fysiske kurs er gjennomført.
                  </p>
                )}
              </div>

              <Input
                label="Frist (antall dager)"
                type="number"
                min="1"
                max="365"
                value={formData.deadlineDays}
                onChange={(e) => setFormData(prev => ({ ...prev, deadlineDays: parseInt(e.target.value) || 14 }))}
                placeholder="14"
                helper="Antall dager brukere har til å fullføre kurset"
              />

              <div>
                <label className="flex items-center mb-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.repetitionEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, repetitionEnabled: e.target.checked }))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2">Aktiver repetisjon</span>
                </label>
                
                {formData.repetitionEnabled && (
                  <Input
                    label="Repetisjon hver (måneder)"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.repetitionInterval}
                    onChange={(e) => setFormData(prev => ({ ...prev, repetitionInterval: parseInt(e.target.value) }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tildel kurs til
                </label>
                <AssignmentSelector
                  companyId={user?.company_id || ''}
                  onSelectionChange={(selection) => {
                    setFormData(prev => ({
                      ...prev,
                      assignment: selection
                    }))
                  }}
                  selection={formData.assignment}
                />
                {editingProgram && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    💡 Tip: Fjern avhaking for å fjerne tildelinger. Allerede tildelte brukere/avdelinger er markert med ✓
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingProgram ? 'Oppdater kurs' : 'Opprett kurs'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Modal>

      {/* Three-level hierarchy: Topics → Themes (Programs) → Courses */}
      <div className="space-y-4">
        {/* Topics (Tema) */}
        {topics.map(topic => {
          const topicThemes = themes.filter(t => t.topic_id === topic.id)
          const topicCourseCount = topicThemes.reduce((acc, t) => acc + (programsByTheme[t.id]?.length || 0), 0)

          return (
            <details
              key={topic.id}
              className="group rounded-lg border-2 border-primary-200 bg-primary-50/30 shadow-sm dark:bg-primary-900/10 dark:border-primary-800"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-primary-600 transition-transform duration-200 group-open:rotate-90" />
                  <Folder className="h-5 w-5 text-primary-600" />
                  <span className="text-lg font-bold text-primary-700 dark:text-primary-400">{topic.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({topicThemes.length} program, {topicCourseCount} kurs)
                  </span>
                </div>
                
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openThemeFormForTopic(topic.id)}
                    className="h-7 text-xs"
                    title="Legg til program i tema"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Program
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditTopic(topic)}
                    className="h-7 text-xs"
                    title="Rediger tema"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="h-7 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Slett tema"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </summary>

              <div className="border-t border-primary-200 dark:border-primary-800 px-4 py-4 space-y-3">
                {topicThemes.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ingen programmer i dette temaet ennå.
                    <Button variant="ghost" size="sm" onClick={() => openThemeFormForTopic(topic.id)} className="ml-1 text-primary-600 hover:text-primary-700">
                      Opprett program
                    </Button>
                  </div>
                ) : (
                  topicThemes.map(theme => {
                    const themePrograms = programsByTheme[theme.id] || []
                    return (
                      <details
                        key={theme.id}
                        className="group/theme rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800"
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-200 group-open/theme:rotate-90" />
                            <Tag className="h-4 w-4 text-primary-600" />
                            <span className="text-base font-semibold">{theme.name}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">({themePrograms.length} kurs)</span>
                            <span className="text-xs text-gray-400">
                              {theme.progression_type === 'sequential_auto' ? '(Sekvensiell Auto)' : 
                               theme.progression_type === 'sequential_manual' ? '(Sekvensiell Manuell)' : ''}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => openCourseFormForTheme(theme.id)} className="h-7 text-xs" title="Legg til kurs i program">
                              <Plus className="h-3 w-3 mr-1" />
                              Kurs
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/programs/${theme.id}/structure`)} className="h-7 text-xs" title="Rediger programstruktur">
                              <Network className="h-3 w-3 mr-1" />
                              Struktur
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => handleOpenAssign(theme)} className="h-7 text-xs">
                              <UserPlus className="h-3 w-3 mr-1" />
                              Tildel
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEditTheme(theme)} className="h-7 text-xs" title="Rediger program">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteTheme(theme.id)} className="h-7 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Slett program">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </summary>

                        <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
                          {themePrograms.length === 0 ? (
                            <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                              Ingen kurs i dette programmet.
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {themePrograms.map((program, index) => (
                                <Card key={program.id}>
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                            {(program.sort_order != null && program.sort_order >= 0) ? program.sort_order + 1 : index + 1}
                                          </span>
                                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                            {program.title}
                                          </h3>
                                        </div>
                                        {program.description && (
                                          <p className="text-sm text-gray-600 dark:text-gray-300">{program.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                          {program.instructor && (
                                            <span className="inline-flex items-center gap-1">
                                              <Users className="h-3 w-3" />
                                              {program.instructor.full_name}
                                            </span>
                                          )}
                                          <span className="inline-flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {program.deadline_days} dager frist
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex space-x-1">
                                        {program.course_type === 'physical-course' ? (
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Fysisk</span>
                                        ) : (
                                          <Button variant="ghost" size="sm" onClick={() => handleEditModules(program)} title="Moduler">
                                            <Settings className="h-4 w-4" />
                                          </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(program)} title="Rediger">
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(program.id)} className="text-red-600 hover:text-red-700" title="Slett">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    )
                  })
                )}
              </div>
            </details>
          )
        })}

        {/* Themes without topic (Uten tema) */}
        {(() => {
          const themesWithoutTopic = themes.filter(t => !t.topic_id)
          if (themesWithoutTopic.length === 0 && !programsByTheme['no-theme']?.length) return null

          return (
            <details className="group rounded-lg border border-gray-300 bg-gray-50 shadow-sm dark:bg-gray-900/50 dark:border-gray-700">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-gray-500 transition-transform duration-200 group-open:rotate-90" />
                  <FolderOpen className="h-5 w-5 text-gray-500" />
                  <span className="text-lg font-semibold">Uten tema</span>
                  <span className="text-sm text-gray-500">
                    ({themesWithoutTopic.length} program, {themesWithoutTopic.reduce((acc, t) => acc + (programsByTheme[t.id]?.length || 0), 0) + (programsByTheme['no-theme']?.length || 0)} kurs)
                  </span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => openThemeFormForTopic(null)} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Program
                  </Button>
                </div>
              </summary>

              <div className="border-t border-gray-300 dark:border-gray-700 px-4 py-4 space-y-3">
                {themesWithoutTopic.map(theme => {
                  const themePrograms = programsByTheme[theme.id] || []
                  return (
                    <details key={theme.id} className="group/theme rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-200 group-open/theme:rotate-90" />
                          <Tag className="h-4 w-4 text-gray-500" />
                          <span className="text-base font-semibold">{theme.name}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">({themePrograms.length} kurs)</span>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => openCourseFormForTheme(theme.id)} className="h-7 text-xs" title="Legg til kurs i program">
                            <Plus className="h-3 w-3 mr-1" />
                            Kurs
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/programs/${theme.id}/structure`)} className="h-7 text-xs">
                            <Network className="h-3 w-3 mr-1" />
                            Struktur
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleOpenAssign(theme)} className="h-7 text-xs">
                            <UserPlus className="h-3 w-3 mr-1" />
                            Tildel
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditTheme(theme)} className="h-7 text-xs" title="Rediger program">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTheme(theme.id)} className="h-7 text-xs text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </summary>
                      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
                        {themePrograms.length === 0 ? (
                          <div className="py-4 text-center text-sm text-gray-500">Ingen kurs i dette programmet.</div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {themePrograms.map((program, index) => (
                              <Card key={program.id}>
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                          {(program.sort_order != null && program.sort_order >= 0) ? program.sort_order + 1 : index + 1}
                                        </span>
                                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{program.title}</h3>
                                      </div>
                                      {program.description && <p className="text-sm text-gray-600 dark:text-gray-300">{program.description}</p>}
                                    </div>
                                    <div className="flex space-x-1">
                                      {program.course_type !== 'physical-course' && (
                                        <Button variant="ghost" size="sm" onClick={() => handleEditModules(program)}><Settings className="h-4 w-4" /></Button>
                                      )}
                                      <Button variant="ghost" size="sm" onClick={() => handleEdit(program)}><Edit2 className="h-4 w-4" /></Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleDelete(program.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  )
                })}

                {/* Courses without program */}
                {programsByTheme['no-theme'] && programsByTheme['no-theme'].length > 0 && (
                  <details className="group/theme rounded-lg border border-dashed border-gray-300 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400 list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-gray-400 transition-transform duration-200 group-open/theme:rotate-90" />
                        <BookOpen className="h-4 w-4 text-gray-400" />
                        <span className="text-base font-medium">Kurs uten program</span>
                        <span className="text-sm text-gray-400">({programsByTheme['no-theme'].length} kurs)</span>
                      </div>
                    </summary>
                    <div className="border-t border-gray-300 dark:border-gray-700 px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {programsByTheme['no-theme'].map((program) => (
                          <Card key={program.id}>
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-2">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{program.title}</h3>
                                  {program.description && <p className="text-sm text-gray-600 dark:text-gray-300">{program.description}</p>}
                                </div>
                                <div className="flex space-x-1">
                                  {program.course_type !== 'physical-course' && (
                                    <Button variant="ghost" size="sm" onClick={() => handleEditModules(program)}><Settings className="h-4 w-4" /></Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => handleEdit(program)}><Edit2 className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(program.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </details>
          )
        })()}

        {/* Empty state */}
        {topics.length === 0 && themes.length === 0 && programs.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Kom i gang med kursopplæring
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Start med å opprette et tema, deretter programmer og kurs.
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="secondary" onClick={() => setShowTopicForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Opprett tema
                </Button>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Opprett kurs
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
