export interface Checklist {
  id: string
  company_id: string
  title: string
  description: string | null
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
  order_index: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  title: string
  description: string | null
  order_index: number
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
  completed_at: string | null
  completed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[]
}

export interface ChecklistAssignment {
  id: string
  checklist_id: string
  assigned_to_user_id: string
  assigned_by: string | null
  assigned_at: string
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Relations
  assigned_to_user?: {
    id: string
    full_name: string
    email: string
  }
}

export interface ChecklistItemStatus {
  id: string
  assignment_id: string
  item_id: string
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
  completed_at: string | null
  completed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Relations
  item?: ChecklistItem
  completed_by_user?: {
    id: string
    full_name: string
  }
}

export interface ChecklistAssignmentWithStatus extends ChecklistAssignment {
  item_statuses: ChecklistItemStatus[]
}

