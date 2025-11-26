export interface Checklist {
  id: string
  company_id: string
  title: string
  description: string | null
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
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

