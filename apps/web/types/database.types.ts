export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type PlanType = 'free' | 'premium'
export type PlanName = 'personal' | 'pareja' | 'familiar'
export type TransactionType = 'income' | 'expense'
export type CategoryType = 'income' | 'expense'
export type Currency = 'PEN' | 'USD'
export type PaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'annual'
export type FamilyMemberStatus = 'pending' | 'active' | 'removed'
export type ChallengeStatus = 'active' | 'completed' | 'abandoned'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          base_currency: Currency
          plan: PlanType
          plan_type: PlanName | null
          plan_expires_at: string | null
          family_group_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          base_currency?: Currency
          plan?: PlanType
          plan_type?: PlanName | null
          plan_expires_at?: string | null
          family_group_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          base_currency?: Currency
          plan?: PlanType
          plan_type?: PlanName | null
          plan_expires_at?: string | null
          family_group_id?: string | null
          updated_at?: string
        }
      }
      family_groups: {
        Row: {
          id: string
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          created_at?: string
        }
        Update: {
          owner_id?: string
        }
      }
      family_members: {
        Row: {
          id: string
          user_id: string
          family_group_id: string
          invited_at: string
          status: FamilyMemberStatus
        }
        Insert: {
          id?: string
          user_id: string
          family_group_id: string
          invited_at?: string
          status?: FamilyMemberStatus
        }
        Update: {
          status?: FamilyMemberStatus
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: CategoryType
          parent_id: string | null
          icon: string | null
          color: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: CategoryType
          parent_id?: string | null
          icon?: string | null
          color?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          name?: string
          type?: CategoryType
          parent_id?: string | null
          icon?: string | null
          color?: string | null
          sort_order?: number
        }
      }
      exchange_rates: {
        Row: {
          id: string
          date: string
          usd_to_pen: number
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          usd_to_pen: number
          source?: string | null
          created_at?: string
        }
        Update: {
          usd_to_pen?: number
          source?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          date: string
          type: TransactionType
          category_id: string | null
          concept: string
          amount: number
          currency: Currency
          amount_pen: number
          receipt_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          type: TransactionType
          category_id?: string | null
          concept: string
          amount: number
          currency?: Currency
          amount_pen: number
          receipt_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          date?: string
          type?: TransactionType
          category_id?: string | null
          concept?: string
          amount?: number
          currency?: Currency
          amount_pen?: number
          receipt_url?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      transaction_details: {
        Row: {
          id: string
          transaction_id: string
          description: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          description: string
          amount: number
          created_at?: string
        }
        Update: {
          description?: string
          amount?: number
        }
      }
      planned_payments: {
        Row: {
          id: string
          user_id: string
          concept: string
          amount: number
          currency: Currency
          category_id: string | null
          frequency: PaymentFrequency
          next_due_date: string
          day_of_month: number | null
          auto_register: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          concept: string
          amount: number
          currency?: Currency
          category_id?: string | null
          frequency: PaymentFrequency
          next_due_date: string
          day_of_month?: number | null
          auto_register?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          concept?: string
          amount?: number
          currency?: Currency
          category_id?: string | null
          frequency?: PaymentFrequency
          next_due_date?: string
          day_of_month?: number | null
          auto_register?: boolean
          is_active?: boolean
          updated_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          year: number
          month: number
          category_id: string
          amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          year: number
          month: number
          category_id: string
          amount: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          updated_at?: string
        }
      }
      debts: {
        Row: {
          id: string
          user_id: string
          creditor: string
          initial_balance: number
          current_balance: number
          monthly_payment: number
          payment_day: number
          interest_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          creditor: string
          initial_balance: number
          current_balance: number
          monthly_payment: number
          payment_day: number
          interest_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          creditor?: string
          current_balance?: number
          monthly_payment?: number
          payment_day?: number
          interest_rate?: number | null
          is_active?: boolean
          updated_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          target_date: string | null
          emoji: string
          is_completed: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          target_date?: string | null
          emoji?: string
          is_completed?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          target_amount?: number
          current_amount?: number
          target_date?: string | null
          emoji?: string
          is_completed?: boolean
          notes?: string | null
        }
      }
      savings_snapshots: {
        Row: {
          id: string
          user_id: string
          year: number
          month: number
          amount: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          year: number
          month: number
          amount: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          amount?: number
          notes?: string | null
        }
      }
      payment_reminders: {
        Row: {
          id: string
          user_id: string
          concept: string
          day_of_month: number
          amount: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          concept: string
          day_of_month: number
          amount?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          concept?: string
          day_of_month?: number
          amount?: number | null
          is_active?: boolean
        }
      }
      health_scores: {
        Row: {
          id: string
          user_id: string
          year: number
          month: number
          score: number
          breakdown: Json
          explanation: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          year: number
          month: number
          score: number
          breakdown: Json
          explanation?: string | null
          created_at?: string
        }
        Update: {
          score?: number
          breakdown?: Json
          explanation?: string | null
        }
      }
      challenges: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          target_amount: number
          start_date: string
          end_date: string
          status: ChallengeStatus
          saved_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          target_amount: number
          start_date: string
          end_date: string
          status?: ChallengeStatus
          saved_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          target_amount?: number
          start_date?: string
          end_date?: string
          status?: ChallengeStatus
          saved_amount?: number
          updated_at?: string
        }
      }
      shared_summaries: {
        Row: {
          id: string
          user_id: string
          token: string
          year: number
          month: number
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          year: number
          month: number
          expires_at: string
          created_at?: string
        }
        Update: {
          expires_at?: string
        }
      }
      ai_insights: {
        Row: {
          id: string
          user_id: string
          type: string
          year: number
          month: number
          input_hash: string
          content: string
          model: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          year: number
          month: number
          input_hash: string
          content: string
          model: string
          created_at?: string
        }
        Update: {
          content?: string
        }
      }
      billing_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          plan: PlanType | null
          plan_type: PlanName | null
          amount: number | null
          currency: string | null
          provider: string | null
          provider_event_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          plan?: PlanType | null
          plan_type?: PlanName | null
          amount?: number | null
          currency?: string | null
          provider?: string | null
          provider_event_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: {
      monthly_summary: {
        Row: {
          user_id: string
          year: number
          month: number
          category_id: string
          category_name: string
          type: CategoryType
          total: number
        }
      }
      budget_vs_actual: {
        Row: {
          user_id: string
          year: number
          month: number
          category_id: string
          category_name: string
          budget: number
          actual: number
          percentage: number
        }
      }
    }
    Functions: {
      get_monthly_balance: {
        Args: { p_user_id: string; p_year: number; p_month: number }
        Returns: { income: number; expenses: number; balance: number }
      }
      get_annual_summary: {
        Args: { p_user_id: string; p_year: number }
        Returns: { month: number; income: number; expenses: number; balance: number }[]
      }
      seed_default_categories: {
        Args: { p_user_id: string }
        Returns: void
      }
      calculate_health_score: {
        Args: { p_user_id: string; p_year: number; p_month: number }
        Returns: Json
      }
    }
  }
}
