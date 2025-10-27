export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      badges: {
        Row: {
          earned_at: string | null
          id: string
          program_id: string
          user_id: string
        }
        Insert: {
          earned_at?: string | null
          id?: string
          program_id: string
          user_id: string
        }
        Update: {
          earned_at?: string | null
          id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      companies: {
        Row: {
          badge_system_enabled: boolean | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          badge_system_enabled?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          badge_system_enabled?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      modules: {
        Row: {
          content: Json
          created_at: string | null
          description: string | null
          id: string
          order_index: number
          program_id: string
          title: string
          type: string
        }
        Insert: {
          content?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          order_index: number
          program_id: string
          title: string
          type: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          program_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string | null
          department_id: string | null
          email: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string | null
          department_id?: string | null
          email: string
          full_name: string
          id: string
          role: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string | null
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      program_departments: {
        Row: {
          department_id: string
          program_id: string
        }
        Insert: {
          department_id: string
          program_id: string
        }
        Update: {
          department_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_departments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          }
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          id: string
          program_id: string
          scheduled_for: string
          sent: boolean | null
          sent_at: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          program_id: string
          scheduled_for: string
          sent?: boolean | null
          sent_at?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          program_id?: string
          scheduled_for?: string
          sent?: boolean | null
          sent_at?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      themes: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "themes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      training_programs: {
        Row: {
          company_id: string
          created_at: string | null
          deadline_days: number | null
          description: string | null
          id: string
          instructor_id: string | null
          repetition_enabled: boolean | null
          repetition_interval_months: number | null
          theme_id: string | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          deadline_days?: number | null
          description?: string | null
          id?: string
          instructor_id?: string | null
          repetition_enabled?: boolean | null
          repetition_interval_months?: number | null
          theme_id?: string | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deadline_days?: number | null
          description?: string | null
          id?: string
          instructor_id?: string | null
          repetition_enabled?: boolean | null
          repetition_interval_months?: number | null
          theme_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          }
        ]
      }
      user_progress: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          data: Json | null
          id: string
          module_id: string
          program_id: string
          score: number | null
          started_at: string | null
          status: string | null
          time_spent_minutes: number | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          module_id: string
          program_id: string
          score?: number | null
          started_at?: string | null
          status?: string | null
          time_spent_minutes?: number | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          module_id?: string
          program_id?: string
          score?: number | null
          started_at?: string | null
          status?: string | null
          time_spent_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type UserRole = 'admin' | 'instructor' | 'user'
export type ModuleType = 'video' | 'document' | 'quiz' | 'interactive'
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'
