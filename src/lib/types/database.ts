// Database type definitions for Supabase tables
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_user_id: string
          email: string
          created_at: string
          user_type: 'CREATOR' | 'FAN'
          onboarding_completed: boolean
          display_name: string | null
          profile_picture_url: string | null
          banner_image_url: string | null
          ccbill_merchant_id: string | null
          monetization_enabled: boolean | null
        }
        Insert: {
          id?: string
          auth_user_id: string
          email: string
          created_at?: string
          user_type: 'CREATOR' | 'FAN'
          onboarding_completed?: boolean
          display_name?: string | null
          profile_picture_url?: string | null
          banner_image_url?: string | null
          ccbill_merchant_id?: string | null
          monetization_enabled?: boolean | null
        }
        Update: {
          id?: string
          auth_user_id?: string
          email?: string
          created_at?: string
          user_type?: 'CREATOR' | 'FAN'
          onboarding_completed?: boolean
          display_name?: string | null
          profile_picture_url?: string | null
          banner_image_url?: string | null
          ccbill_merchant_id?: string | null
          monetization_enabled?: boolean | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          creator_id: string
          fan_id: string
          sender_id: string
          content: string
          created_at: string
          is_locked: boolean
          ppv_price_cents: number | null
          media_id: string | null
          comped_by_creator: boolean | null
        }
        Insert: {
          id?: string
          creator_id: string
          fan_id: string
          sender_id: string
          content: string
          created_at?: string
          is_locked?: boolean
          ppv_price_cents?: number | null
          media_id?: string | null
          comped_by_creator?: boolean | null
        }
        Update: {
          id?: string
          creator_id?: string
          fan_id?: string
          sender_id?: string
          content?: string
          created_at?: string
          is_locked?: boolean
          ppv_price_cents?: number | null
          media_id?: string | null
          comped_by_creator?: boolean | null
        }
      }
      chat_access: {
        Row: {
          id: string
          creator_id: string
          fan_id: string
          state: 'granted' | 'expired'
          access_until: string
          last_qualifying_purchase_id: string | null
          created_at: string
          updated_at: string
          status: string | null
        }
        Insert: {
          id?: string
          creator_id: string
          fan_id: string
          state: 'granted' | 'expired'
          access_until: string
          last_qualifying_purchase_id?: string | null
          created_at?: string
          updated_at?: string
          status?: string | null
        }
        Update: {
          id?: string
          creator_id?: string
          fan_id?: string
          state?: 'granted' | 'expired'
          access_until?: string
          last_qualifying_purchase_id?: string | null
          created_at?: string
          updated_at?: string
          status?: string | null
        }
      }
      chat_rules: {
        Row: {
          creator_id: string
          min_spend_cents: number
          access_window_days: number
          created_at: string
          updated_at: string
          access_days: number | null
        }
        Insert: {
          creator_id: string
          min_spend_cents?: number
          access_window_days?: number
          created_at?: string
          updated_at?: string
          access_days?: number | null
        }
        Update: {
          creator_id?: string
          min_spend_cents?: number
          access_window_days?: number
          created_at?: string
          updated_at?: string
          access_days?: number | null
        }
      }
      conversations: {
        Row: {
          id: string
          creator_id: string
          fan_id: string
          last_message_id: string | null
          last_message_at: string
          last_message_preview: string | null
          message_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          fan_id: string
          last_message_id?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          message_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          fan_id?: string
          last_message_id?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          message_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      purchases: {
        Row: {
          id: string
          profile_id: string
          task_id: string
          amount_cents: number
          processor: 'CCBILL' | 'SEGPAY' | 'EPOCH'
          processor_tx_id: string
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          task_id: string
          amount_cents: number
          processor: 'CCBILL' | 'SEGPAY' | 'EPOCH'
          processor_tx_id: string
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          task_id?: string
          amount_cents?: number
          processor?: 'CCBILL' | 'SEGPAY' | 'EPOCH'
          processor_tx_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_chat_access: {
        Args: {
          p_creator: string
          p_fan: string
          p_purchase_id: string
        }
        Returns: void
      }
    }
    Enums: {
      user_type: 'CREATOR' | 'FAN'
      processor: 'CCBILL' | 'SEGPAY' | 'EPOCH'
      media_type: 'IMAGE' | 'VIDEO'
    }
  }
}

// Helper type to get table row types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

// Specific table types for easy import
export type Profile = Tables<'profiles'>
export type ChatMessage = Tables<'chat_messages'>
export type ChatAccess = Tables<'chat_access'>
export type ChatRules = Tables<'chat_rules'>
export type Conversation = Tables<'conversations'>
export type Purchase = Tables<'purchases'>
