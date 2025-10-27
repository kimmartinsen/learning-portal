// Utvidede TypeScript-typer for den nye strukturen

export interface Module {
  id: string
  program_id: string
  title: string
  description: string | null
  type: string
  content: any
  order_index: number
  created_at: string
}

export interface Theme {
  id: string
  company_id: string
  name: string
  description: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface EnhancedTrainingProgram {
  id: string
  company_id: string
  theme_id: string | null
  title: string
  description: string | null
  instructor_id: string | null
  deadline_days: number // Number of days to complete (default: 14)
  repetition_enabled: boolean
  repetition_interval_months: number | null
  created_at: string
  
  // Relations
  theme?: Theme
  instructor?: { full_name: string }
  modules?: Module[]
}

export interface ProgramAssignment {
  id: string
  program_id: string
  
  // Assignment target (either user OR department)
  assigned_to_user_id: string | null
  assigned_to_department_id: string | null
  
  // Assignment metadata
  assigned_by: string
  assigned_at: string
  
  // Requirements and deadline
  due_date: string
  is_mandatory: boolean
  max_attempts: number
  
  // Status tracking
  status: 'assigned' | 'started' | 'completed' | 'overdue' | 'cancelled'
  completed_at: string | null
  
  // Additional info
  notes: string | null
  reminder_sent_at: string | null
  created_at: string
  
  // Relations (populated in views)
  program_title?: string
  program_description?: string
  theme_name?: string
  theme_color?: string
  assigned_to_name?: string
  assignment_type?: 'user' | 'department'
  calculated_status?: string
  days_remaining?: number
  progress_percentage?: number
}

export interface UserAssignment {
  id: string
  program_id: string
  assigned_to_user_id: string
  due_date: string
  is_mandatory: boolean
  status: string
  calculated_status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
  days_remaining: number
  notes: string | null
  
  // Program info
  program_title: string
  program_description: string | null
  theme_name: string | null
  theme_color: string | null
  
  // Progress info
  progress_percentage: number
  modules_total: number
  modules_completed: number
}

export interface EnhancedUserProgress {
  id: string
  user_id: string
  program_id: string
  module_id: string
  assignment_id: string | null // New connection to assignment
  status: 'not_started' | 'in_progress' | 'completed'
  started_at: string | null
  completed_at: string | null
  time_spent_minutes: number
  attempts: number
  score: number | null
  data: any
  created_at: string
}

// Dashboard data structures
export interface ThemeWithPrograms extends Theme {
  programs: EnhancedTrainingProgram[]
  total_programs: number
  active_assignments: number
}

export interface AdminDashboardStats {
  total_themes: number
  total_programs: number
  active_assignments: number
  overdue_assignments: number
  completion_rate: number
  upcoming_deadlines: ProgramAssignment[]
}

export interface UserDashboardData {
  active_assignments: UserAssignment[]
  completed_assignments: UserAssignment[]
  overdue_assignments: UserAssignment[]
  upcoming_deadlines: UserAssignment[]
  progress_summary: {
    total_assigned: number
    completed: number
    in_progress: number
    overdue: number
    completion_rate: number
  }
}

// Form data types for UI
export interface CreateThemeFormData {
  name: string
  description: string
}

export interface AssignProgramFormData {
  program_id: string
  assignment_type: 'user' | 'department' | 'bulk'
  
  // Single assignments
  user_id?: string
  department_id?: string
  
  // Bulk assignments
  user_ids?: string[]
  department_ids?: string[]
  
  // Assignment settings
  due_days: number // Days from now
  is_mandatory: boolean
  max_attempts: number
  notes?: string
  
  // Scheduling
  send_reminder: boolean
  reminder_days_before?: number
}

export interface BulkAssignmentResult {
  success_count: number
  error_count: number
  errors: Array<{
    target_id: string
    target_name: string
    error: string
  }>
  created_assignments: ProgramAssignment[]
}
