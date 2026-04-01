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
          about_text: string | null
          // Tribute-specific columns
          handle: string | null
          wallet_address: string | null
          age_verified: boolean | null
          age_verified_at: string | null
          tribute_alias: string | null
          vip_cta_text: string | null
          tagline: string | null
          bio: string | null
          kyc_status: string | null
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
          about_text?: string | null
          handle?: string | null
          wallet_address?: string | null
          age_verified?: boolean | null
          age_verified_at?: string | null
          tribute_alias?: string | null
          vip_cta_text?: string | null
          tagline?: string | null
          bio?: string | null
          kyc_status?: string | null
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
          about_text?: string | null
          handle?: string | null
          wallet_address?: string | null
          age_verified?: boolean | null
          age_verified_at?: string | null
          tribute_alias?: string | null
          vip_cta_text?: string | null
          tagline?: string | null
          bio?: string | null
          kyc_status?: string | null
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
          tier: string | null
          rank_at_grant: number | null
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
          tier?: string | null
          rank_at_grant?: number | null
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
          tier?: string | null
          rank_at_grant?: number | null
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
          fan_id: string | null
          task_id: string
          usdc_tx_hash: string | null
          amount_usdc: number | null
          wallet_address: string | null
          purchase_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          fan_id?: string | null
          task_id: string
          usdc_tx_hash?: string | null
          amount_usdc?: number | null
          wallet_address?: string | null
          purchase_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          fan_id?: string | null
          task_id?: string
          usdc_tx_hash?: string | null
          amount_usdc?: number | null
          wallet_address?: string | null
          purchase_type?: string | null
          created_at?: string
        }
      }
      media_assets: {
        Row: {
          id: string
          creator_id: string
          type: 'IMAGE' | 'VIDEO'
          title: string | null
          playback_ref: string | null
          thumbnail_url: string | null
          file_size: number | null
          mime_type: string | null
          created_at: string
          bunny_url: string | null
          bunny_preview_url: string | null
          price_usdc: number | null
        }
        Insert: {
          id?: string
          creator_id: string
          type?: 'IMAGE' | 'VIDEO'
          title?: string | null
          playback_ref?: string | null
          thumbnail_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
          bunny_url?: string | null
          bunny_preview_url?: string | null
          price_usdc?: number | null
        }
        Update: {
          id?: string
          creator_id?: string
          type?: 'IMAGE' | 'VIDEO'
          title?: string | null
          playback_ref?: string | null
          thumbnail_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
          bunny_url?: string | null
          bunny_preview_url?: string | null
          price_usdc?: number | null
        }
      }
      tasks: {
        Row: {
          id: string
          creator_id: string
          slug: string
          title: string
          description: string | null
          price_cents: number
          points: number
          media_id: string | null
          active: boolean
          created_at: string
          updated_at: string
          task_type: 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT' | null
          status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null
          price_usdc: number | null
          instructions: string | null
          repetition_phrase: string | null
          required_repetitions: number | null
        }
        Insert: {
          id?: string
          creator_id: string
          slug: string
          title: string
          description?: string | null
          price_cents?: number
          points?: number
          media_id?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
          task_type?: 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT' | null
          status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null
          price_usdc?: number | null
          instructions?: string | null
          repetition_phrase?: string | null
          required_repetitions?: number | null
        }
        Update: {
          id?: string
          creator_id?: string
          slug?: string
          title?: string
          description?: string | null
          price_cents?: number
          points?: number
          media_id?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
          task_type?: 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT' | null
          status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null
          price_usdc?: number | null
          instructions?: string | null
          repetition_phrase?: string | null
          required_repetitions?: number | null
        }
      }
      task_completions: {
        Row: {
          id: string
          task_id: string
          fan_id: string
          status: 'ACCEPTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
          payment_tx_hash: string | null
          amount_usdc: number | null
          tribute_message: string
          submission_text: string | null
          evidence_url: string | null
          repetition_count: number | null
          dom_feedback: string | null
          accepted_at: string | null
          submitted_at: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          fan_id: string
          status?: 'ACCEPTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
          payment_tx_hash?: string | null
          amount_usdc?: number | null
          tribute_message: string
          submission_text?: string | null
          evidence_url?: string | null
          repetition_count?: number | null
          dom_feedback?: string | null
          accepted_at?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          fan_id?: string
          status?: 'ACCEPTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
          payment_tx_hash?: string | null
          amount_usdc?: number | null
          tribute_message?: string
          submission_text?: string | null
          evidence_url?: string | null
          repetition_count?: number | null
          dom_feedback?: string | null
          accepted_at?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
      }
      content_unlocks: {
        Row: {
          id: string
          fan_id: string
          media_id: string
          payment_tx_hash: string | null
          amount_usdc: number | null
          unlocked_at: string
        }
        Insert: {
          id?: string
          fan_id: string
          media_id: string
          payment_tx_hash?: string | null
          amount_usdc?: number | null
          unlocked_at?: string
        }
        Update: {
          id?: string
          fan_id?: string
          media_id?: string
          payment_tx_hash?: string | null
          amount_usdc?: number | null
          unlocked_at?: string
        }
      }
      tribute_scores: {
        Row: {
          id: string
          fan_id: string
          dom_id: string
          total_score: number
          spend_score: number
          task_score: number
          tenure_score: number
          diversity_score: number
          tier: string
          month_year: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fan_id: string
          dom_id: string
          total_score?: number
          spend_score?: number
          task_score?: number
          tenure_score?: number
          diversity_score?: number
          tier?: string
          month_year: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fan_id?: string
          dom_id?: string
          total_score?: number
          spend_score?: number
          task_score?: number
          tenure_score?: number
          diversity_score?: number
          tier?: string
          month_year?: string
          created_at?: string
          updated_at?: string
        }
      }
      vip_tiers: {
        Row: {
          id: string
          dom_id: string
          tier_type: 'GROUP' | 'PRIVATE'
          threshold_type: 'TOP_PERCENT' | 'TOP_N'
          threshold_value: number
          min_spend_usdc: number
          reset_day: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dom_id: string
          tier_type: 'GROUP' | 'PRIVATE'
          threshold_type: 'TOP_PERCENT' | 'TOP_N'
          threshold_value: number
          min_spend_usdc?: number
          reset_day?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dom_id?: string
          tier_type?: 'GROUP' | 'PRIVATE'
          threshold_type?: 'TOP_PERCENT' | 'TOP_N'
          threshold_value?: number
          min_spend_usdc?: number
          reset_day?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      vip_messages: {
        Row: {
          id: string
          dom_id: string
          sender_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          dom_id: string
          sender_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          dom_id?: string
          sender_id?: string
          content?: string
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
      recalculate_tribute_score: {
        Args: { p_fan_id: string; p_dom_id: string }
        Returns: void
      }
      recalculate_vip_access: {
        Args: { p_dom_id: string }
        Returns: void
      }
    }
    Enums: {
      user_type: 'CREATOR' | 'FAN'
      media_type: 'IMAGE' | 'VIDEO'
      task_type: 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT'
      task_status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
      completion_status: 'ACCEPTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
      vip_tier_type: 'GROUP' | 'PRIVATE'
      threshold_type: 'TOP_PERCENT' | 'TOP_N'
    }
  }
}

// Helper type to get table row types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

// Specific table types for easy import
export type Profile = Tables<'profiles'>
export type ChatMessage = Tables<'chat_messages'>
export type ChatAccess = Tables<'chat_access'>
export type Conversation = Tables<'conversations'>
export type Purchase = Tables<'purchases'>
export type MediaAsset = Tables<'media_assets'>
export type Task = Tables<'tasks'>
export type TaskCompletion = Tables<'task_completions'>
export type ContentUnlock = Tables<'content_unlocks'>
export type TributeScore = Tables<'tribute_scores'>
export type VipTier = Tables<'vip_tiers'>
export type VipMessage = Tables<'vip_messages'>
